'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const userTools = require('./tools/user-tools');
const roleTools = require('./tools/role-tools');
const ownershipTools = require('./tools/ownership-tools');
const recordTools = require('./tools/record-tools');

// ── Tool Definitions (MCP format — inputSchema, not input_schema) ──────────
const TOOL_DEFINITIONS = [
  {
    name: 'list_users',
    description: 'List Salesforce users. Filter by active/inactive status.',
    inputSchema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean', description: 'true = active only, false = inactive only' },
        limit: { type: 'number', description: 'Max records (default 20)' },
      },
    },
  },
  {
    name: 'get_user_details',
    description: 'Get detailed information about a specific Salesforce user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        username: { type: 'string', description: 'Salesforce username (e.g. user@org.com)' },
        email: { type: 'string' },
      },
    },
  },
  {
    name: 'deactivate_user',
    description: 'Deactivate a Salesforce user (set IsActive = false).',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
  {
    name: 'activate_user',
    description: 'Activate (re-enable) a Salesforce user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
  {
    name: 'update_user',
    description: 'Update fields on a Salesforce user (Title, Department, Phone, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string' },
        updates: {
          type: 'object',
          description: 'Fields to update. E.g. {"Title":"Manager","Department":"Sales"}',
        },
      },
      required: ['updates'],
    },
  },
  {
    name: 'list_profiles',
    description: 'List all Salesforce profiles.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_user_profile',
    description: 'Change the profile assigned to a Salesforce user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string' },
        profileName: { type: 'string', description: 'Profile name e.g. "Standard User"' },
        profileId: { type: 'string' },
      },
    },
  },
  {
    name: 'list_roles',
    description: 'List all Salesforce roles in the org hierarchy.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_user_role',
    description: 'Get the current role assigned to a user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
  {
    name: 'update_user_role',
    description: 'Assign or change the role of a Salesforce user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string' },
        roleName: { type: 'string', description: 'Role name e.g. "VP of Sales"' },
        roleId: { type: 'string' },
      },
    },
  },
  {
    name: 'remove_user_role',
    description: 'Remove the role assignment from a Salesforce user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
  {
    name: 'get_record_owner',
    description: 'Get the current owner of an Account, Contact, Opportunity, Lead, or Case.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', enum: ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'] },
        recordId: { type: 'string' },
        recordName: { type: 'string' },
      },
      required: ['objectType'],
    },
  },
  {
    name: 'transfer_record_ownership',
    description: 'Transfer ownership of a single record to a new user.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', enum: ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'] },
        recordId: { type: 'string' },
        recordName: { type: 'string' },
        newOwnerUsername: { type: 'string' },
        newOwnerEmail: { type: 'string' },
        newOwnerId: { type: 'string' },
      },
      required: ['objectType'],
    },
  },
  {
    name: 'bulk_transfer_ownership',
    description: 'Transfer ALL records of an object type from one user to another.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', enum: ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'] },
        currentOwnerUsername: { type: 'string' },
        currentOwnerEmail: { type: 'string' },
        newOwnerUsername: { type: 'string' },
        newOwnerEmail: { type: 'string' },
        limit: { type: 'number', description: 'Max records to transfer (default 50)' },
      },
      required: ['objectType'],
    },
  },
  {
    name: 'list_records',
    description: 'List records of an object type, optionally filtered by owner.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', enum: ['Account', 'Contact', 'Opportunity', 'Lead', 'Case'] },
        ownerUsername: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['objectType'],
    },
  },
  {
    name: 'update_record',
    description: 'Update one or more fields on any Salesforce record (Account, Contact, Opportunity, Lead, Case, Task, etc.). Use this for address changes, field updates, status changes, and any write operation.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'e.g. Account, Contact, Opportunity, Lead, Case, Task' },
        recordId: { type: 'string', description: 'Salesforce record ID (18-char)' },
        recordName: { type: 'string', description: 'Record name to look up if ID not known' },
        fields: {
          type: 'object',
          description: 'Key-value pairs of fields to update. Examples: {"BillingStreet":"123 Main St","BillingCity":"Austin","BillingPostalCode":"78701"} or {"Phone":"555-1234"} or {"StageName":"Closed Won"}',
        },
      },
      required: ['objectType', 'fields'],
    },
  },
  {
    name: 'create_record',
    description: 'Create a new Salesforce record (Account, Contact, Case, Task, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'Object type to create' },
        fields: {
          type: 'object',
          description: 'Field values for the new record. E.g. {"LastName":"Smith","Email":"a@b.com"} for Contact',
        },
      },
      required: ['objectType', 'fields'],
    },
  },
  {
    name: 'get_record',
    description: 'Get specific fields from a Salesforce record by ID or name. Works for Account, Contact, Opportunity, Lead, Case, User, and any standard object.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string' },
        recordId: { type: 'string' },
        recordName: { type: 'string' },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field API names. E.g. ["BillingStreet","BillingCity","Phone","Website","AnnualRevenue"]',
        },
      },
      required: ['objectType'],
    },
  },
  {
    name: 'query_records',
    description: 'Run any SOQL SELECT query against any Salesforce object — Account, Contact, Opportunity, Lead, Case, User, UserRole, Profile, LoginHistory, AuthSession, Task, Event, Campaign, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        soql: {
          type: 'string',
          description: 'Full SOQL SELECT statement. E.g. "SELECT Id, Name, Email FROM Contact WHERE AccountId = \'001xx\'"',
        },
        limit: { type: 'number', description: 'Override or set LIMIT (default 50)' },
      },
      required: ['soql'],
    },
  },
  {
    name: 'describe_object',
    description: 'Get the field schema (name, type, label, updateable) for any Salesforce object — useful before updating records.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'e.g. Account, Contact, Opportunity, User, Case' },
      },
      required: ['objectType'],
    },
  },
];

// ── Tool Handlers ──────────────────────────────────────────────────────────
const HANDLERS = {
  list_users: (args) => userTools.listUsers(args),
  get_user_details: (args) => userTools.getUserDetails(args),
  deactivate_user: (args) => userTools.deactivateUser(args),
  activate_user: (args) => userTools.activateUser(args),
  update_user: (args) => userTools.updateUser(args),
  list_profiles: () => userTools.listProfiles(),
  update_user_profile: (args) => userTools.updateUserProfile(args),
  list_roles: () => roleTools.listRoles(),
  get_user_role: (args) => roleTools.getUserRole(args),
  update_user_role: (args) => roleTools.updateUserRole(args),
  remove_user_role: (args) => roleTools.removeUserRole(args),
  get_record_owner: (args) => ownershipTools.getRecordOwner(args),
  transfer_record_ownership: (args) => ownershipTools.transferRecordOwnership(args),
  bulk_transfer_ownership: (args) => ownershipTools.bulkTransferOwnership(args),
  list_records: (args) => ownershipTools.listRecords(args),
  update_record: (args) => recordTools.updateRecord(args),
  create_record: (args) => recordTools.createRecord(args),
  get_record: (args) => recordTools.getRecord(args),
  query_records: (args) => recordTools.queryRecords(args),
  describe_object: (args) => recordTools.describeObject(args),
};

// ── MCP Server ─────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'salesforce-admin', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = HANDLERS[name];

  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await handler(args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use stderr so stdout stays clean for MCP protocol
  process.stderr.write('Salesforce MCP Server ready (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`[sfdc-mcp-server] Fatal: ${err.message}\n`);
  process.exit(1);
});
