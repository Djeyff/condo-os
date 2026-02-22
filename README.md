# 🏢 Condo Manager OS

**Complete AI-powered condominium & property management system for OpenClaw.**

Turn your AI assistant into a full-time property manager — handles double-entry accounting, owner payments, quarterly fee calls, maintenance tracking, financial reporting, and owner communications through Notion databases.

Built from managing a real condominium — not theory. Every workflow, edge case, and template comes from actual property administration experience.

## ✨ Features

- 🧮 **Double-entry owner accounting** — individual accounts with running balances per unit
- 💰 **Fee calls** — automatic quarterly/monthly calculation based on ownership shares (tantièmes)
- 📊 **Budget vs actual** — variance tracking by category with Q1-Q4 breakdown
- 🏗️ **Works & projects** — voted works with staged contractor payments (advance/progress/final)
- 💳 **Multi-account cash tracking** — bank accounts, petty cash, reserve funds with full transaction history
- 📨 **Owner communications** — escalating delinquency notices (friendly → formal → legal), fee call letters, year-end statements
- 📋 **Year-end closing** — automatic reconciliation of provisional vs actual charges
- 📥 **Excel import** — migrate from spreadsheets with auto-detection of sheet types
- 🌐 **Multilingual** — Spanish, English, and French support
- 🔒 **Privacy guardrails** — never exposes one owner's data to another

## 🚀 Quick Start

### 1. Install the skill
```bash
# From ClaHub
openclaw skill install condo-manager-os

# Or manually
git clone <repo> ~/.openclaw/skills/condo-manager-os
cd ~/.openclaw/skills/condo-manager-os && npm install
```

### 2. Set up Notion
- Create a Notion integration at https://www.notion.so/my-integrations
- Set `NOTION_API_KEY` in your OpenClaw environment
- Create a parent page in Notion and share it with your integration

### 3. Run setup
```bash
node scripts/setup.js --parent-page=YOUR_PAGE_ID
```

This creates **10 databases** with full schemas, relations, formulas, rollups, and color-coded selects. Zero manual Notion steps.

### 4. Import existing data (optional)
```bash
node scripts/import-excel.js your-financial-data.xlsx --dry-run  # Preview
node scripts/import-excel.js your-financial-data.xlsx             # Import
```

### 5. Start managing
Just talk to your assistant:
- *"Generate fee call for Q1 2026"*
- *"Unit A-3 paid 25,000 by bank transfer, ref #7821"*
- *"Who owes money?"*
- *"Monthly financial report for January"*
- *"Prepare year-end closing for 2025"*

## 📦 CLI Commands

```bash
# Fee management
node scripts/condo-cli.js fee-call Q2 2026              # Issue quarterly charges
node scripts/condo-cli.js payment A-3 25000 --ref=7821  # Record payment

# Reporting
node scripts/condo-cli.js statement A-1 --lang=fr       # Owner statement
node scripts/condo-cli.js report monthly 2026-01         # Financial report
node scripts/condo-cli.js delinquency --detail           # Delinquent units
node scripts/condo-cli.js dashboard                      # Quick overview

# Operations
node scripts/condo-cli.js expense "INAPA" 3600 --category=Utilities --account=banco
node scripts/condo-cli.js assessment "Roof Repair" 186000 --vote-type="Electronic Vote"
node scripts/condo-cli.js close-year 2025 --total-expenses=955962 --confirm
```

## 🗄️ Database Schema

| Database | Purpose |
|----------|---------|
| 🏠 Units Registry | Units, owners, shares, balances, fee status |
| 💰 Owner Ledger | All financial transactions per owner |
| 📋 Budget | Annual budget with Q1-Q4 actual tracking |
| 💸 Expenses | Operating expenses by category |
| 🔧 Maintenance | Work orders and repairs |
| 🏗️ Works & Projects | Voted works with staged payments |
| 🏦 Cash Position | Bank accounts, petty cash, reserves |
| 💳 Account Movements | Full transaction history per account |
| 📨 Communications Log | Owner/tenant communication audit trail |
| 📅 Meetings | Board meetings, AGMs, assemblies |

All databases are **automatically cross-linked** with relations, rollups, and formulas.

## 🔧 Configuration

After setup, your `config.json` contains:
```json
{
  "building": {
    "name": "My Building",
    "address": "123 Main St",
    "currency": "DOP",
    "feeFrequency": "quarterly",
    "annualBudget": 547840
  },
  "databases": {
    "units": "notion-db-id",
    "ledger": "notion-db-id",
    ...
  }
}
```

## 📨 Communication Templates

The skill includes professional templates for:
- Fee call letters (with individual amounts and balances)
- Payment reminders (4 escalation levels)
- Year-end owner statements
- Financial situation reports
- Meeting agendas and minutes
- Delinquency notices (friendly → formal → pre-legal → legal)

All templates support multiple languages and are generated with real data from your Notion databases.

## 🛡️ Guardrails

- **Privacy**: Never exposes one owner's financial details to another
- **Accuracy**: All ledger entries require confirmation before writing
- **Audit trail**: Corrections via adjustment entries, never deletions
- **Safety**: Year-end closing is dry-run by default, requires `--confirm`

## 📋 Requirements

- OpenClaw with Notion integration
- Node.js 18+
- `NOTION_API_KEY` environment variable
- `xlsx` npm package (for Excel import)

## 📄 License

MIT — Built by [casedamare](https://clawhub.com/casedamare)
