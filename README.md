# Salesforce Virtual Admin Assistant

A natural-language Salesforce admin tool powered by **Claude Haiku** and the **Model Context Protocol (MCP)**. Ask plain-English questions or give instructions — the AI issues the right Salesforce API calls and returns readable results.

---

## Features

| Category | Capabilities |
|---|---|
| **User Admin** | List users, view details, activate / deactivate, update fields, change profiles |
| **Role Management** | List roles, view / assign / remove role assignments |
| **Record Ownership** | View owner, transfer a single record, bulk-transfer all records from one user to another |
| **Full DML** | Create, read, update any standard object (Account, Contact, Opportunity, Lead, Case, Task, Event, …) |
| **SOQL Queries** | Run ad-hoc SELECT queries — login history, audit, reports, any object |
| **Login Activity** | "Show login history for john@company.com" — pulled live from `LoginHistory` |
| **Cost Tracking** | Live token usage and USD cost shown in the sidebar each turn |

### Supported Salesforce objects

CRM · Activity · Commerce · Marketing · Service · Admin / Setup · Audit

`Account` `Contact` `Opportunity` `Lead` `Case` `Task` `Event` `Contract` `Order` `Quote` `Product2` `Pricebook2` `Campaign` `CampaignMember` `User` `UserRole` `Profile` `PermissionSet` `Group` `LoginHistory` `AuthSession` + more

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser  →  React + Vite  (port 3000)                       │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP POST /api/chat
┌──────────────────────────▼───────────────────────────────────┐
│  Express API  (port 3001)  —  server.js                      │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  claude-agent.js  —  Claude Haiku agentic loop               │
│  • Calls Anthropic API with merged MCP tool list             │
│  • Loops on tool_use until end_turn                          │
│  • Routes each tool call to the correct MCP server           │
└────────────┬──────────────────────────────┬──────────────────┘
             │ stdio (subprocess)            │ stdio (subprocess)
┌────────────▼──────────────┐   ┌───────────▼──────────────────┐
│  sfdc-mcp-server.js       │   │  @salesforce/mcp  (official) │
│  Custom admin MCP server  │   │  run_soql_query              │
│  user / role / ownership  │   │  get_username                │
│  update_record            │   │  assign_permission_set       │
│  create_record            │   └──────────────────────────────┘
│  query_records            │
│  describe_object          │
└────────────┬──────────────┘
             │
┌────────────▼──────────────┐
│  jsforce  →  Salesforce   │
│  REST / SOAP API          │
└───────────────────────────┘
```

**Model**: `claude-haiku-4-5-20251001` — lowest-cost Claude model ($0.80 / M input, $4.00 / M output)

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | `node --version` |
| npm | ≥ 9 | bundled with Node |
| Salesforce CLI (`sf`) | latest | `npm install -g @salesforce/cli` |
| Anthropic API key | — | [console.anthropic.com](https://console.anthropic.com) |

---

## Quick Start

### 1 · Clone the repo

```bash
git clone https://github.com/srinipusuluri/sfdc-admin-assist-claude-agent.git
cd sfdc-admin-assist-claude-agent
```

### 2 · Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3 · Configure credentials

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Salesforce Connected App (see below for setup instructions)
SF_CONSUMER_KEY=your_connected_app_consumer_key
SF_CONSUMER_SECRET=your_connected_app_consumer_secret

# Salesforce user
SF_USERNAME=admin@yourorg.com
SF_PASSWORD=yourpassword          # wrap in quotes if it contains special chars
SF_LOGIN_URL=https://login.salesforce.com   # or https://test.salesforce.com for sandbox
```

### 4 · Update `.mcp.json`

Replace the placeholder values in `.mcp.json` at the project root with your actual credentials (same values as `.env`). This file configures the MCP servers when using Claude Code directly.

### 5 · Test the Salesforce connection

```bash
cd backend
node test-connection.js
```

Expected output:
```
Connected to Salesforce
  Org:      00Dxx0000000000EAA
  Username: admin@yourorg.com
  Auth:     OAuth 2.0 Connected App
```

### 6 · Start the app

```bash
# From the project root — starts both servers:
./start.sh
```

Open **http://localhost:3000**

---

## Salesforce Connected App Setup

A Connected App lets the tool authenticate via OAuth 2.0 instead of a plain username/password.

1. In Salesforce Setup → search **App Manager** → **New Connected App**
2. Fill in:
   - **Connected App Name**: `Virtual Admin Assistant`
   - **API Name**: auto-fills
   - **Contact Email**: your email
3. Under **API (Enable OAuth Settings)**:
   - Check **Enable OAuth Settings**
   - **Callback URL**: `http://localhost:3001/oauth/callback`
   - **Selected OAuth Scopes**: `api`, `refresh_token`, `offline_access`
4. Save, then wait ~10 minutes for it to propagate
5. Click **Manage** → **Edit Policies** → set **IP Relaxation** to _Relax IP restrictions_
6. To enable username-password flow: **Manage** → **Edit Policies** → **OAuth Policies** → set **Permitted Users** to _All users may self-authorize_ and enable **Enable OAuth Username-Password Flows**

> **Note**: If "Allow OAuth Username-Password Flows" is not enabled, the app automatically falls back to SOAP authentication — this is shown in the Connection Status panel as `SOAP (enable OAuth in Connected App)`. Everything still works.

---

## Example Prompts

### User Administration
```
List all active users
Show details for john@company.com
Deactivate user sarah@company.com — she's left the company
Activate user mike@company.com
Update john@company.com: set Title to "Senior Manager" and Department to "Sales"
Change sarah@company.com's profile to "Standard Platform User"
```

### Role Management
```
Show all roles in the org
What role does mike@company.com have?
Assign VP of Sales role to john@company.com
Remove the role from temp-user@company.com
```

### Record Operations
```
Who owns the Account "Acme Corp"?
Transfer the Acme Corp account to bob@company.com
Bulk transfer all Leads from departing@company.com to newrep@company.com
Update the billing address for Acme Corp to 123 Main St, Austin TX 78701
Change the stage of opportunity "Q4 Deal" to Closed Won
Create a new Contact: Jane Smith, jane@acme.com at Acme Corp
```

### SOQL & Audit
```
Show login history for john@company.com
Find all Opportunities closing this month worth more than $50,000
List contacts at Acme Corp
Show the last 20 failed login attempts
How many active users do we have?
```

---

## Project Structure

```
sfdc-admin-assist-claude-agent/
├── .env.example              ← template — copy to backend/.env and fill in
├── .gitignore
├── .mcp.json                 ← MCP server config for Claude Code (update placeholders)
├── start.sh                  ← one-command launcher
├── README.md
│
├── backend/
│   ├── server.js             ← Express API (POST /api/chat, GET /api/status)
│   ├── claude-agent.js       ← Claude Haiku + dual MCP agentic loop
│   ├── sfdc-mcp-server.js    ← Custom MCP server (all admin tools)
│   ├── sfdc-client.js        ← jsforce Salesforce connection
│   ├── refresh-sf-auth.js    ← Re-registers CLI auth on startup
│   ├── test-connection.js    ← Quick connection validator
│   ├── .env.example          ← credential template
│   └── tools/
│       ├── user-tools.js     ← User CRUD, profiles
│       ├── role-tools.js     ← Role assignments
│       ├── ownership-tools.js← Record ownership transfer
│       └── record-tools.js   ← Generic DML + SOQL (update/create/get/query/describe)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx           ← Layout: sidebar + chat
        ├── App.css
        ├── main.jsx
        └── components/
            ├── Header.jsx
            ├── ChatInterface.jsx
            ├── Message.jsx
            ├── QuickActions.jsx
            ├── CostTracker.jsx
            └── ConnectionStatus.jsx
```

---

## Security

- **`backend/.env` is gitignored** — never committed; contains real credentials
- **`.mcp.json` contains only placeholders** — fill in locally, do not commit with real values
- **`.claude/settings.local.json` is gitignored** — contains local Claude Code permissions
- The backend exposes no admin credentials to the browser; all Salesforce calls happen server-side
- Before any destructive action (deactivate user, bulk transfer), the AI confirms with the user

---

## Cost

All AI calls use **Claude Haiku** — the lowest-cost Claude model:

| | Price |
|---|---|
| Input tokens | $0.80 / million |
| Output tokens | $4.00 / million |

A typical admin question costs **< $0.001**. The sidebar tracks exact token counts and USD cost per session.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `authentication failure` on startup | Check `SF_USERNAME` / `SF_PASSWORD` in `.env`; if password has `#`, wrap it in double-quotes |
| `invalid_grant` | Enable OAuth Username-Password Flows in the Connected App, or leave as-is (SOAP fallback works) |
| `MCP connection failed` | Run `node backend/test-connection.js` to validate SF credentials first |
| `Insufficient privileges` | The SF user must have System Administrator or equivalent API permissions |
| Claude refuses to update records | Shouldn't happen — if it does, report it as a bug |
| High token costs | Reduce conversation history; start a new session for unrelated tasks |

---

## License

MIT
