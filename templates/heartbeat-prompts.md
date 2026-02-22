# Condo Manager OS — Heartbeat Prompts

Copy these into your OpenClaw heartbeat/cron configuration for proactive management.

---

## 📋 Daily Morning Briefing
**Schedule**: Every day at 7:00 AM
**Heartbeat prompt**:

```
Run the Condo Manager OS daily briefing:

1. EMERGENCY: Any maintenance requests with Priority = Emergency that are not Completed/Closed
2. OVERDUE PAYMENTS: Units with negative balance where Last Payment Date is more than 30 days ago
3. FOLLOW-UPS DUE TODAY: Communications with Follow-up Required = true and Follow-up Date = today
4. PENDING APPROVALS: Expenses with Status = Pending
5. EXPIRING LEASES: Any leases ending within the next 30 days
6. OPEN MAINTENANCE: Requests with Status ≠ Completed/Closed, older than 7 days
7. CASH ALERT: If total cash (Operating + Petty Cash) is less than 1 month of expenses, flag it

Format as a concise briefing. If nothing urgent, respond: "✅ All clear — no urgent items today."
If there ARE items, list them by urgency with the most critical first.
```

---

## 📊 Weekly Summary
**Schedule**: Monday at 9:00 AM
**Heartbeat prompt**:

```
Generate the Condo Manager OS weekly summary:

1. FINANCIAL SNAPSHOT:
   - Payments received this week (total + per unit)
   - Expenses paid this week (total + by category)
   - Net cash flow for the week
   - Current bank + petty cash balance

2. MAINTENANCE:
   - New requests this week
   - Completed this week
   - Still open (with age in days)

3. COLLECTION STATUS:
   - Current month collection rate (payments received / total called)
   - Units still outstanding for this period
   - Total receivables (sum of all negative balances)

4. COMMUNICATIONS:
   - Messages sent this week
   - Follow-ups still pending

5. UPCOMING THIS WEEK:
   - Scheduled payments to vendors
   - Insurance or contract deadlines
   - Meetings

Format as a 2-minute executive summary. Include the numbers, not just descriptions.
```

---

## 💰 Monthly Close & Fee Cycle
**Schedule**: 1st of each month at 8:00 AM
**Heartbeat prompt**:

```
It's the first of the month. Run the Condo Manager OS monthly cycle:

PART 1 — CLOSE PREVIOUS MONTH:
1. Generate the full financial report for last month:
   - Revenue summary (all payments received, by unit)
   - Expense breakdown by category (with budget vs actual)
   - Cash flow statement (opening → +income → -expenses → closing)
   - Cash position across all accounts
2. List all overdue units with:
   - Unit number, amount owed, days overdue
   - Last payment date
   - Previous reminder sent (date and level)
3. Update Fee Status on Units Registry based on current balances

PART 2 — NEW MONTH ACTIONS:
4. If this is a quarter start (Jan, Apr, Jul, Oct):
   - Calculate the quarterly fee call for each unit
   - Draft individual fee call letters with amounts and balances
   - Present all letters for my review
5. Draft payment reminders for all overdue units:
   - 1-15 days: Friendly reminder
   - 16-30 days: Formal notice
   - 31-60 days: Written warning
   - 60+: Pre-legal notice
6. Flag any upcoming expenses or deadlines this month

Present everything for my review. Do NOT send anything automatically.
```

---

## 📅 Quarterly Review
**Schedule**: 1st of Jan, Apr, Jul, Oct at 9:00 AM
**Heartbeat prompt**:

```
It's quarter start. Run the Condo Manager OS quarterly review:

1. QUARTERLY FINANCIAL REPORT:
   - Full income/expense report for the previous quarter
   - Budget vs actual comparison by category
   - Variance analysis (flag anything >15% over budget)
   - Year-to-date cumulative vs annual budget

2. CASH POSITION AUDIT:
   - Current balance in every account
   - Reserve fund status vs target
   - Verify: total cash + total receivables vs total obligations

3. DELINQUENCY DEEP DIVE:
   - Full delinquency report with amounts, age, and escalation history
   - Impact analysis: what would cash position be if all owners were current?
   - Recommended next actions per delinquent unit

4. MAINTENANCE REVIEW:
   - All work completed this quarter (cost summary)
   - Open items carried forward
   - Upcoming scheduled maintenance

5. WORKS & PROJECTS:
   - Status of all active projects
   - Payments made to contractors this quarter
   - Remaining obligations

6. UPCOMING QUARTER:
   - Expected fee call total
   - Known upcoming expenses (insurance, contracts, seasonal)
   - Meetings to schedule

Format as a comprehensive but readable quarterly report.
```

---

## 🏢 Annual / Pre-AGM
**Schedule**: Run manually before the Annual General Meeting
**Heartbeat prompt**:

```
Prepare the full AGM package for [YEAR]:

1. ANNUAL FINANCIAL REPORT:
   - Complete income statement (all revenue by source)
   - Complete expense statement (by category, monthly breakdown)
   - Budget vs actual with explanations for major variances
   - Cash flow statement for the full year
   - Cash position at year end (all accounts)
   - Reserve fund status

2. OWNER BALANCES:
   - Individual account summaries (for private distribution)
   - Anonymized balance summary by unit number (for group presentation)
   - Total receivables outstanding
   - Delinquency history and actions taken

3. MAINTENANCE SUMMARY:
   - All work completed with costs
   - Open items and estimated costs
   - Condition assessment of major systems

4. WORKS & PROJECTS:
   - Completed projects with final costs vs quoted
   - Active projects with status
   - Proposed projects for next year with estimated costs

5. PROPOSED BUDGET for [NEXT YEAR]:
   - Based on this year's actuals, adjusted for known changes
   - Per-unit fee calculation at current ownership shares
   - Reserve fund contribution recommendation

6. MEETING PREP:
   - Draft agenda
   - Required documents list
   - Quorum requirements
   - Proxy form template
   - Voting items with context

Present everything for review. I'll finalize before distribution.
```

---

## 🚨 Emergency Check (Optional — High Frequency)
**Schedule**: Every 6 hours (if desired)
**Heartbeat prompt**:

```
Quick emergency check for Condo Manager OS:
- Any new maintenance requests with Priority = Emergency?
- Any unread urgent communications received?
If nothing: respond with HEARTBEAT_OK only.
If there is something: alert me with details.
```

---

## Setup Instructions

### For OpenClaw Heartbeat (built-in):
Add to your `openclaw.json`:
```json
{
  "heartbeat": {
    "enabled": true,
    "interval": "daily",
    "prompt": "[paste the daily briefing prompt above]"
  }
}
```

### For Cron-based scheduling:
Add to your OpenClaw cron jobs (`~/.openclaw/jobs.json`):
```json
[
  {
    "name": "daily-briefing",
    "schedule": "0 7 * * *",
    "prompt": "[paste daily briefing prompt]"
  },
  {
    "name": "weekly-summary",
    "schedule": "0 9 * * 1",
    "prompt": "[paste weekly summary prompt]"
  },
  {
    "name": "monthly-cycle",
    "schedule": "0 8 1 * *",
    "prompt": "[paste monthly close prompt]"
  }
]
```
