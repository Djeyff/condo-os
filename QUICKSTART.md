# Condo Manager OS — Quick Start Guide

Welcome! This guide will get you from zero to a fully operational AI property management system in about 30 minutes.

---

## What's in the Box

```
condo-manager-os/
├── SKILL.md                          ← Core skill (install this)
├── README.md                         ← Overview and sales info
├── QUICKSTART.md                     ← You are here
│
├── scripts/
│   └── setup-databases.sh            ← Auto-creates 9 Notion databases
│
├── templates/
│   ├── MEMORY.md                     ← Pre-configured agent memory (customize & install)
│   ├── SOUL.md                       ← Agent personality config (customize & install)
│   └── heartbeat-prompts.md          ← Copy-paste prompts for proactive management
│
└── references/
    └── accounting-guide.md           ← Domain knowledge: accounting, maintenance, legal
```

---

## Step 1: Prerequisites (5 minutes)

You need:
- ✅ OpenClaw installed and running (any platform)
- ✅ A Notion account (free tier works)
- ✅ An AI model configured in OpenClaw (Claude recommended, GPT works too)
- ✅ The Notion skill installed: `npx clawdhub@latest install notion`

---

## Step 2: Create Notion Integration (3 minutes)

1. Go to https://www.notion.so/my-integrations
2. Click **"+ New integration"**
3. Name it: "Condo Manager OS" (or your building name)
4. Select your workspace
5. Click **Submit**
6. Copy the **Internal Integration Token** (starts with `ntn_`)
7. Set it in your OpenClaw environment:
   ```bash
   export NOTION_API_KEY="ntn_your_token_here"
   ```
   Or add it to `~/.openclaw/openclaw.json`:
   ```json
   {
     "env": {
       "NOTION_API_KEY": "ntn_your_token_here"
     }
   }
   ```

---

## Step 3: Create Parent Page in Notion (1 minute)

1. In Notion, create a new page called **"🏢 [Your Building Name] — Management"**
2. Click **"..."** → **"Connections"** → Add your "Condo Manager OS" integration
3. Copy the page ID from the URL:
   - URL: `https://notion.so/My-Building-Management-abc123def456`
   - Page ID: `abc123def456` (the last part)

---

## Step 4: Run Database Setup (2 minutes)

```bash
chmod +x scripts/setup-databases.sh
./scripts/setup-databases.sh YOUR_NOTION_API_KEY YOUR_PAGE_ID
```

This creates all 9 databases with correct schemas. Save the database IDs that are printed.

**If you prefer manual setup**: Open each database schema in SKILL.md and create them manually in Notion. The script just saves time.

---

## Step 5: Add Relations in Notion (5 minutes)

The API can't create relation properties between new databases, so add these manually:

1. **Owner Ledger** → Add "Unit" relation → link to Units Registry
2. **Expenses** → Add "Unit" relation → link to Units Registry
3. **Expenses** → Add "Budget Line" relation → link to Budget
4. **Maintenance Requests** → Add "Unit" relation → link to Units Registry
5. **Maintenance Requests** → Add "Related Expense" relation → link to Expenses
6. **Communications Log** → Add "Unit" relation → link to Units Registry

In Notion: Open database → **"+"** for new property → Select "Relation" → Choose target database.

---

## Step 6: Install the Skill (1 minute)

```bash
# Copy the skill folder to your OpenClaw skills directory
cp -r condo-manager-os/ ~/.openclaw/skills/condo-manager-os/

# Or if using workspace skills:
cp -r condo-manager-os/ ~/clawd/skills/condo-manager-os/
```

Verify it's loaded:
```bash
openclaw skills list
# Should show: condo-manager-os ✅
```

---

## Step 7: Configure MEMORY.md (10 minutes)

Open `templates/MEMORY.md` and fill in:

1. **Building profile**: name, address, units, currency, dates
2. **Database IDs**: Paste all 9 IDs from the setup script output
3. **Bank details**: For fee call letters
4. **Unit registry**: Each unit with owner name and ownership percentage
5. **Budget**: Current year approved budget total
6. **Emergency contacts**: Plumber, electrician, contractor, insurance

Then install it:
```bash
cp templates/MEMORY.md ~/.openclaw/MEMORY.md
# Or merge with your existing MEMORY.md
```

---

## Step 8: Configure SOUL.md (2 minutes)

Open `templates/SOUL.md`, customize the placeholders, and install:
```bash
# Merge with your existing SOUL.md or use as-is
cat templates/SOUL.md >> ~/.openclaw/SOUL.md
```

---

## Step 9: Test It (5 minutes)

Message your OpenClaw agent with these test commands:

**Test 1 — Unit lookup:**
> "Show me the details for Unit A-1"

**Test 2 — Fee calculation:**
> "Calculate the Q1 2026 fee call for all units"

**Test 3 — Record a payment:**
> "Unit A-3 paid 25,000 by bank transfer today"

**Test 4 — Morning briefing:**
> "Give me the daily briefing"

**Test 5 — Financial report:**
> "Generate the monthly financial report for last month"

**Test 6 — Delinquency check:**
> "Who owes money? Show me the delinquency report"

---

## Step 10: Set Up Heartbeats (Optional, 3 minutes)

For proactive management, configure heartbeat prompts from `templates/heartbeat-prompts.md`:
- **Daily briefing**: 7 AM check for urgents and overdue items
- **Weekly summary**: Monday summary with numbers
- **Monthly cycle**: Auto-generates reports and reminders

See the heartbeat file for exact configuration.

---

## You're Live! 🎉

Your AI property management assistant is now operational. Here's what to do next:

### This Week
- [ ] Enter all units with owners, shares, and contacts
- [ ] Enter current year's approved budget
- [ ] Set up cash position accounts with current balances
- [ ] Enter any existing owner balances (opening balances)

### This Month
- [ ] Log a few real expenses to test the flow
- [ ] Generate your first monthly report
- [ ] Send your first fee call (draft → review → send)
- [ ] Set up heartbeat prompts

### Ongoing
- [ ] Log expenses as they happen (via WhatsApp/chat)
- [ ] Record payments as they arrive
- [ ] Let the AI draft your communications
- [ ] Run monthly reports on the 1st
- [ ] Run quarterly reviews
- [ ] Do year-end closing with the AI's help

---

## Common Commands Cheat Sheet

| You Say | What Happens |
|---------|-------------|
| "Fee call for Q2" | Calculates per-unit amounts, drafts letters |
| "[Unit] paid [amount]" | Records payment, updates balance |
| "Paid [vendor] [amount] for [what]" | Logs expense |
| "Who owes?" | Delinquency report |
| "Monthly report" | Full financial report |
| "Send reminders" | Drafts severity-appropriate messages |
| "[Unit] has a [problem]" | Creates maintenance request |
| "Prepare for the meeting" | Full AGM/meeting package |
| "Close fiscal year [year]" | Year-end closing process |
| "Explain the financial situation" | Audit + owner communication draft |
| "Statement for [Unit]" | Individual account ledger |
| "Morning briefing" | Quick status check |

---

## Troubleshooting

**"Notion API key not working"**
→ Make sure the integration is shared with the parent page AND each database

**"Can't find database"**
→ Verify database IDs in MEMORY.md match the ones from setup

**"Skill not loading"**
→ Check: `openclaw skills list`. Make sure `SKILL.md` is in the right folder.

**"Calculations seem wrong"**
→ Verify ownership shares sum to exactly 100%. Check MEMORY.md.

**"Agent doesn't remember the building"**
→ Check that MEMORY.md is in the correct path and contains building info.

---

## Support

Questions? Issues? Suggestions?
- GitHub: [your-repo-link]
- Email: [your-email]
- ClawHub: [skill page link]

Built by **Case Damare Real Estate & Buildings** — from real condo management experience.
