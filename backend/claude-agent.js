'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const { refreshSFAuth } = require('./refresh-sf-auth');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-haiku-4-5-20251001';
const COST_PER_M_INPUT = 0.80;
const COST_PER_M_OUTPUT = 4.00;

// ── Dual MCP Client State ──────────────────────────────────────────────────
let customClient = null;    // our sfdc-mcp-server.js (users, roles, ownership)
let officialClient = null;  // @salesforce/mcp   (run_soql_query, login history)
let mergedTools = null;
const toolServerMap = {};   // toolName → 'custom' | 'official'

// Official toolsets relevant for admin: data (SOQL) + users + core
const OFFICIAL_TOOLSETS = 'data,users,core';
// Official tools we want to expose (skip LWC/mobile/devops noise)
const OFFICIAL_TOOLS_ALLOWLIST = new Set([
  'run_soql_query',
  'get_username',
  'assign_permission_set',
  'resume_tool_operation',
  'list_all_orgs',
]);

async function getMCPClients() {
  if (customClient && officialClient) return { tools: mergedTools };

  // Refresh Salesforce CLI auth so @salesforce/mcp can connect
  await refreshSFAuth();

  // ── 1. Custom admin MCP server ───────────────────────────────────────────
  const customTransport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, 'sfdc-mcp-server.js')],
    env: { ...process.env },
  });
  customClient = new Client({ name: 'sfdc-admin-custom', version: '1.0.0' }, { capabilities: {} });
  await customClient.connect(customTransport);
  const { tools: customToolsList } = await customClient.listTools();
  const customToolNames = new Set(customToolsList.map((t) => t.name));
  customToolsList.forEach((t) => { toolServerMap[t.name] = 'custom'; });

  // ── 2. Official @salesforce/mcp (data + users + core toolsets) ───────────
  const officialTransport = new StdioClientTransport({
    command: 'node',
    args: [
      path.join(__dirname, 'node_modules/@salesforce/mcp/bin/run.js'),
      '-o', process.env.SF_USERNAME,
      '--toolsets', OFFICIAL_TOOLSETS,
      '--no-telemetry',
    ],
    env: { ...process.env },
  });
  officialClient = new Client({ name: 'sfdc-admin-official', version: '1.0.0' }, { capabilities: {} });
  await officialClient.connect(officialTransport);
  const { tools: officialToolsList } = await officialClient.listTools();

  // Only include whitelisted official tools that don't clash with custom tools
  const selectedOfficialTools = officialToolsList.filter(
    (t) => OFFICIAL_TOOLS_ALLOWLIST.has(t.name) && !customToolNames.has(t.name)
  );
  selectedOfficialTools.forEach((t) => { toolServerMap[t.name] = 'official'; });

  // Merge: custom tools first, then selected official tools
  const allTools = [...customToolsList, ...selectedOfficialTools];
  mergedTools = allTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema || { type: 'object', properties: {} },
  }));

  return { tools: mergedTools };
}

function resetClients() {
  customClient = null;
  officialClient = null;
  mergedTools = null;
  Object.keys(toolServerMap).forEach((k) => delete toolServerMap[k]);
}

// ── System Prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a Salesforce Virtual Admin Assistant. You help admins manage their org through natural language.

You have two tool sources:
1. **Custom admin tools** — User admin (list/activate/deactivate/update/profile), Role management, Record ownership, and **full DML operations**:
   - update_record: update ANY field on Account, Contact, Opportunity, Lead, Case, Task, etc.
   - create_record: create new records
   - get_record: fetch specific fields from a record
2. **Official Salesforce MCP** (run_soql_query) — For read-only queries:
   - Login activity history: SELECT Id, LoginTime, LoginType, Status, SourceIp, Browser, Platform, UserId, User.Name FROM LoginHistory WHERE ... ORDER BY LoginTime DESC LIMIT 20
   - Custom reports, audit queries, any ad-hoc SOQL

Guidelines:
Object coverage for SOQL (query_records / run_soql_query) and DML (update_record / create_record):
  - CRM: Account, Contact, Opportunity, Lead, Case
  - Activity: Task, Event
  - Commerce: Contract, Order, Quote, Product2, Pricebook2
  - Marketing: Campaign, CampaignMember
  - Admin: User, UserRole, Profile, PermissionSet, Group
  - Audit: LoginHistory, AuthSession

Guidelines:
- For ANY write operation (address, phone, status, stage, any field) use update_record — NEVER say you cannot update records.
- For read queries use query_records (SOQL) or run_soql_query from the official server.
- Use describe_object to discover field names before updating if unsure of the API name.
- Format results as readable tables with headers.
- Before destructive actions (deactivate user, bulk transfer, delete), confirm with the user.
- Common address fields — Account: BillingStreet/BillingCity/BillingState/BillingPostalCode/BillingCountry; Contact: MailingStreet/MailingCity/MailingState/MailingPostalCode.
- The org username for get_username is: ${process.env.SF_USERNAME}`;

// ── Main Chat Function ─────────────────────────────────────────────────────
async function chat(messages) {
  let tools;
  try {
    ({ tools } = await getMCPClients());
  } catch (err) {
    resetClients();
    throw new Error(`MCP connection failed: ${err.message}`);
  }

  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allToolCalls = [];

  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools,
    messages: apiMessages,
  });

  totalInputTokens += response.usage.input_tokens;
  totalOutputTokens += response.usage.output_tokens;

  const workingMessages = [...apiMessages];

  while (response.stop_reason === 'tool_use') {
    workingMessages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      allToolCalls.push({ name: block.name, input: block.input });

      let resultText;
      try {
        const server = toolServerMap[block.name] === 'official' ? officialClient : customClient;
        const mcpResult = await server.callTool({ name: block.name, arguments: block.input });
        resultText = mcpResult.content.map((c) => c.text || '').join('\n');
      } catch (err) {
        resetClients();
        resultText = JSON.stringify({ error: err.message });
      }

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
    }

    workingMessages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages: workingMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  const finalText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const inputCost = (totalInputTokens / 1_000_000) * COST_PER_M_INPUT;
  const outputCost = (totalOutputTokens / 1_000_000) * COST_PER_M_OUTPUT;

  return {
    text: finalText,
    toolCalls: allToolCalls,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      inputCost: inputCost.toFixed(6),
      outputCost: outputCost.toFixed(6),
      totalCost: (inputCost + outputCost).toFixed(6),
    },
  };
}

module.exports = { chat, MODEL };
