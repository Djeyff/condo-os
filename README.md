# 🏢 Condo Manager OS

> AI-powered condominium management for OpenClaw + Notion

Turn your OpenClaw agent into a full-stack property management system. 11 interconnected Notion databases, 17 CLI commands, owner self-service portal, automation workflows, and live dashboards — all from one skill.

## ⚡ Quick Start

```bash
# 1. Install the skill
openclaw skill install condo-manager-os

# 2. Create a parent page in Notion (share with your integration)

# 3. Run setup — creates all 11 databases with relations, formulas, rollups
node scripts/setup.js --parent-page=YOUR_NOTION_PAGE_ID

# 4. Verify
node scripts/condo-cli.js dashboard
```

## 📊 What You Get

### 11 Interconnected Databases
| Database | Purpose |
|----------|---------|
| 🏠 Units Registry | Units, owners, ownership shares, balances |
| 💰 Owner Ledger | All financial transactions per unit |
| 📋 Budget | Annual budget with quarterly breakdown |
| 💸 Expenses | Building expenses linked to budget lines |
| 🔧 Maintenance | Maintenance requests with priority & tracking |
| 🏗️ Works & Projects | Capital works with payment tranches |
| 🏦 Cash Position | Bank accounts & petty cash |
| 💳 Account Movements | Full audit trail of account transactions |
| 📨 Communications Log | Fee calls, reminders, legal notices |
| 📅 Meetings | AGMs, board meetings, electronic votes |
| 🗳️ Resolutions & Votes | Per-unit voting with auto-calculated results |

All databases are linked with **dual relations** — click any field to navigate between connected records.

### 17 CLI Commands

```bash
# Core Operations
condo-cli.js fee-call Q2 2026          # Issue quarterly charges
condo-cli.js payment A-3 25000         # Record a payment
condo-cli.js statement A-1 --lang=fr   # Owner account statement
condo-cli.js report monthly 2026-01    # Financial report
condo-cli.js delinquency --detail      # Who owes what
condo-cli.js dashboard                 # Quick overview
condo-cli.js close-year 2025           # Year-end reconciliation
condo-cli.js expense "INAPA" 3600      # Log an expense
condo-cli.js assessment "Roof" 186000  # Distribute work cost

# Premium
condo-cli.js late-fees --rate=0.02     # Auto-calculate penalties
condo-cli.js reminder --level=2        # Escalating payment notices
condo-cli.js reserve-projection        # 5-year fund projection
condo-cli.js agm-prep 2026             # Full AGM package
condo-cli.js vote "Budget" --meeting="AGM"  # Record votes
condo-cli.js meeting-report "AGM 2025" # Full meeting minutes
condo-cli.js payment-plan A-1 187000 --installments=12  # Installment plans
condo-cli.js export A-1 --lang=es      # Exportable statement
```

### 🤖 Owner Portal (Telegram Bot)

Self-service portal for condo owners:
- 💰 Check balance in real-time
- 📊 View account statement
- 🔧 Submit maintenance requests (→ creates Notion entry + notifies admin)
- 📅 See upcoming meetings
- 📢 Read building announcements
- 📞 Contact administration
- 🌐 Trilingual: Spanish, English, French

```bash
# Start the portal bot
PORTAL_BOT_TOKEN=xxx node scripts/owner-portal.js

# Or use the process manager
scripts/portal-ctl.sh start
```

### ⚙️ Automation Workflows

7 event-driven workflows that monitor your databases:

| Workflow | Trigger | Action |
|----------|---------|--------|
| Payment Received | New payment in ledger | Notify admin + owner |
| Maintenance Update | Status change | Notify owner |
| Overdue Alert | Unit 30+ days past due | Alert admin |
| Meeting Reminder | 48h before meeting | Notify all |
| Budget Overrun | Expense hits 90% of line | Alert admin |
| Cash Critical | Total below threshold | Alert admin |
| Portal Submission | New maintenance request | Alert admin |

```bash
node scripts/automations.js run      # Run once (cron)
node scripts/automations.js daemon   # Continuous (15min polls)
node scripts/automations.js test     # Dry-run
```

### 📈 Live Dashboards

5 auto-generated Notion dashboard pages with KPI cards, progress bars, and color-coded indicators:

- 📈 **KPI Dashboard** — Financial health, operations, governance
- 📊 **Financial Dashboard** — Cash, budget vs actual, income trends
- 🔴 **Delinquency Tracker** — Per-unit aging, impact analysis
- 🔧 **Maintenance Board** — Status/priority breakdown, open items
- 🏗️ **Works & Projects** — Portfolio progress, payment tracking

```bash
node scripts/refresh-dashboards.js --setup   # Create pages (first time)
node scripts/refresh-dashboards.js           # Refresh with live data
```

### 📥 Excel Import

Migrate from spreadsheets in minutes:

```bash
node scripts/import-excel.js your-data.xlsx
```

Auto-detects sheet types (units, ledger, expenses, movements, budget) and imports everything with proper relations.

## ⚙️ Configuration

Copy `config.example.json` to `config.json` and fill in:

```json
{
  "building": {
    "name": "Your Building",
    "units": 7,
    "currency": "DOP",
    "feeFrequency": "quarterly",
    "annualBudget": 524000
  },
  "notion": {
    "parentPageId": "YOUR_PAGE_ID"
  },
  "portal": {
    "botToken": "TELEGRAM_BOT_TOKEN",
    "adminChatId": "YOUR_CHAT_ID",
    "defaultLang": "es",
    "pins": { "A-1": "1234" }
  }
}
```

Database IDs are auto-populated by `setup.js`.

## 🔒 Security

- Bot token stored in `.env` (gitignored)
- Owner authentication via unit + PIN
- Portal sessions persisted locally
- No data leaves Notion — all queries are direct API calls
- Config with real IDs is gitignored

## 📋 Requirements

- [OpenClaw](https://openclaw.ai) agent
- Notion workspace with an integration
- Node.js 18+
- `xlsx` npm package (for Excel import)
- `grammy` npm package (for portal bot)

## 🌐 Languages

All CLI commands and the portal bot support:
- 🇪🇸 Spanish (default)
- 🇬🇧 English
- 🇫🇷 French

## 📄 License

MIT — free to use, modify, and distribute.

## 🔗 Links

- [Landing Page](https://casedamare.github.io/condo-os)
- [ClawHub](https://clawhub.com)
- [OpenClaw](https://openclaw.ai)
- [Discord](https://discord.com/invite/clawd)

---

Built with 🏗️ by real property managers, for real property managers.
