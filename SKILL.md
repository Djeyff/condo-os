---
name: condo-manager-os
description: Complete AI condominium & property management operating system with double-entry accounting, owner individual accounts, fee calls, expense tracking, delinquency management, financial auditing, year-end closing, owner communications, and Notion-powered dashboards. Use when the user mentions rent, tenants, owners, maintenance, condo fees, HOA, expenses, payments, accounting, budget, financial report, delinquency, year-end closing, fee call, reserves, common charges, owner statement, building management, or AGM.
version: 2.0.0
author: casedamare
metadata:
  openclaw:
    emoji: "🏢"
    requires:
      env:
        - NOTION_API_KEY
      bins:
        - curl
    primaryEnv: NOTION_API_KEY
    install:
      - id: notion-skill
        kind: note
        label: "Requires the Notion skill. Set NOTION_API_KEY from https://www.notion.so/my-integrations"
---

# Condo Manager OS — Complete Property & Condominium Management

Your AI-powered condominium administration operating system. Built from real-world condo management experience — not theory.

This skill turns OpenClaw into a full-time property management assistant that handles accounting, maintenance, communications, and reporting through Notion databases.

## Core Capabilities

### 🧮 Accounting Engine
- Individual owner accounts with running balances (credit/debit)
- Quarterly or monthly fee calls based on ownership shares (tantièmes/percentage)
- Automatic proportional expense distribution
- Work provisions with staged contractor payments (advance/progress/final)
- Multi-account cash position tracking (bank, petty cash, reserve fund)
- Budget vs actual comparison
- Year-end closing (provisional → approved)
- Delinquency impact analysis on building cash flow

### 🔧 Maintenance Management
- Work order creation, prioritization, assignment, tracking
- Emergency priority classification
- Contractor management and cost tracking
- Common area inspection scheduling

### 📨 Owner & Tenant Communications
- Fee call letters with individual amounts
- Payment reminders with escalating severity
- Financial situation reports with transparent tables
- Meeting agendas and minutes
- Year-end owner statements
- Violation notices
- Bilingual support (any language pair)

### 📊 Financial Reporting
- Monthly/quarterly income & expense reports
- Owner individual account statements
- Cash flow analysis
- Delinquency reports
- Budget tracking
- Reserve fund status
- Year-end audit summary

---

## When to Activate

Trigger on ANY mention of:

**Accounting**: accounting, budget, expenses, income, revenue, cash flow, balance, ledger, fiscal year, closing, provision, fee call, charges, dues, assessment, debit, credit, statement, audit, reconciliation

**Payments**: payment, paid, overdue, delinquent, late, collection, receipt, transfer, deposit, partial payment, payment plan, arrears

**Property**: unit, apartment, condo, condominium, building, common area, owner, tenant, occupant, lease, vacancy

**Maintenance**: maintenance, repair, work order, broken, fix, contractor, vendor, inspection, emergency

**Communications**: notice, reminder, letter, email, meeting, AGM, assembly, minutes, agenda, vote

**Financial**: report, summary, financial situation, reserve fund, insurance, utilities, budget variance

---

## Notion Database Schema

### 1. 🏠 Units Registry
The foundation — every unit in the building with ownership shares.

| Property | Type | Description |
|----------|------|-------------|
| Unit | Title | Unit identifier (e.g., "A-1", "PH-2", "101") |
| Owner Name | Text | Full legal name of owner |
| Owner Email | Email | Primary contact email |
| Owner Phone | Phone | Primary contact phone |
| Owner Address | Text | Mailing address (if different from unit) |
| Tenant Name | Text | Current tenant (blank if owner-occupied) |
| Tenant Email | Email | Tenant contact |
| Tenant Phone | Phone | Tenant contact |
| Ownership Share (%) | Number | Percentage of common charges (tantièmes). All units must sum to 100% |
| Status | Select | `Owner-Occupied`, `Rented`, `Vacant`, `Under Renovation`, `Foreclosure` |
| Size | Number | Unit size in sqft or m² |
| Bedrooms | Number | Number of bedrooms |
| Floor | Number | Floor number |
| Parking Space | Text | Assigned parking ID |
| Monthly Fee | Formula | = Annual Budget × Ownership Share ÷ 12 |
| Quarterly Fee | Formula | = Annual Budget × Ownership Share ÷ 4 |
| Current Balance | Number | Running balance (positive = credit, negative = debt). Updated by accounting workflows |
| Fee Status | Select | `Current`, `Overdue 1-30`, `Overdue 31-60`, `Overdue 61-90`, `Overdue 90+`, `Payment Plan`, `Legal` |
| Lease Start | Date | Current lease start |
| Lease End | Date | Current lease expiry |
| Notes | Text | General notes |
| Last Payment Date | Date | Date of most recent payment received |
| Emergency Contact | Text | Secondary emergency contact |

### 2. 💰 Owner Ledger (Individual Accounts)
**This is the heart of the accounting system.** Every financial transaction for every owner — payments in, charges out — creating a running balance per unit.

| Property | Type | Description |
|----------|------|-------------|
| Entry | Title | Auto-description: "A-1 — Q1 2026 Common Charges" or "A-1 — Payment 15/01/2026" |
| Unit | Relation | → Units Registry |
| Date | Date | Transaction date |
| Type | Select | `Fee Call`, `Payment Received`, `Work Assessment`, `Adjustment`, `Late Fee`, `Credit`, `Refund`, `Private Charge`, `Year-End Closing Adjustment` |
| Debit | Number | Amount charged TO the owner (increases debt) |
| Credit | Number | Amount paid BY the owner or credited (reduces debt) |
| Balance After | Number | Running balance after this transaction (calculated) |
| Period | Text | Fiscal period reference: "Q1 2026", "Annual 2025", "Work A — Roof Repair" |
| Category | Select | `Common Charges`, `Extraordinary Assessment`, `Work Provision`, `Insurance`, `Reserve Fund`, `Administrative`, `Legal Fees`, `Private` |
| Payment Method | Select | `Cash`, `Bank Transfer`, `Check`, `Credit Card`, `Offset/Credit` |
| Reference | Text | Check number, transfer reference, invoice number |
| Notes | Text | Additional context |
| Verified | Checkbox | Has this entry been verified/reconciled? |
| Fiscal Year | Number | The fiscal year this entry belongs to (e.g., 2025, 2026) |

### 3. 📋 Budget
Annual budget with categories and quarterly breakdown.

| Property | Type | Description |
|----------|------|-------------|
| Category | Title | Budget line item (e.g., "Electricity — Common Areas") |
| Annual Budget | Number | Approved annual amount |
| Q1 Budget | Formula | = Annual Budget ÷ 4 |
| Q2 Budget | Formula | = Annual Budget ÷ 4 |
| Q3 Budget | Formula | = Annual Budget ÷ 4 |
| Q4 Budget | Formula | = Annual Budget ÷ 4 |
| Q1 Actual | Number | Actual Q1 spending (updated as expenses are logged) |
| Q2 Actual | Number | Actual Q2 spending |
| Q3 Actual | Number | Actual Q3 spending |
| Q4 Actual | Number | Actual Q4 spending |
| Annual Actual | Formula | = Q1 + Q2 + Q3 + Q4 Actual |
| Variance | Formula | = Annual Actual − Annual Budget |
| Variance % | Formula | = Variance ÷ Annual Budget × 100 |
| Department | Select | `Utilities`, `Maintenance`, `Security`, `Insurance`, `Cleaning`, `Landscaping`, `Administrative`, `Legal`, `Reserve Fund`, `Capital Works`, `Other` |
| Status | Select | `On Track`, `Over Budget`, `Under Budget` |
| Notes | Text | Justification for variances |

### 4. 💸 Expenses
Every expense paid by the condominium.

| Property | Type | Description |
|----------|------|-------------|
| Description | Title | What was paid for |
| Amount | Number | Amount |
| Date | Date | Payment date |
| Category | Select | Matches Budget categories |
| Vendor | Text | Who was paid |
| Unit | Relation | → Units (if unit-specific; blank for common) |
| Invoice Number | Text | Vendor invoice reference |
| Receipt | Files | Upload receipt/invoice |
| Payment Method | Select | `Cash`, `Bank Transfer`, `Check`, `Credit Card` |
| Paid From | Select | `Operating Account`, `Petty Cash`, `Reserve Fund` |
| Approved By | Text | Who authorized this expense |
| Status | Select | `Pending`, `Approved`, `Paid`, `Disputed`, `Voided` |
| Budget Line | Relation | → Budget (links to budget category) |
| Fiscal Year | Number | Year |
| Quarter | Select | `Q1`, `Q2`, `Q3`, `Q4` |
| Is Extraordinary | Checkbox | Outside regular budget (voted work, emergency) |
| Notes | Text | Additional details |

### 5. 🔧 Maintenance Requests
Work orders and repair tracking.

| Property | Type | Description |
|----------|------|-------------|
| Request | Title | Brief description |
| Unit | Relation | → Units (blank for common areas) |
| Priority | Select | `Emergency 🔴`, `High 🟠`, `Medium 🟡`, `Low 🟢` |
| Status | Select | `New`, `Assigned`, `In Progress`, `Waiting on Parts`, `Completed`, `Closed`, `Cancelled` |
| Category | Select | `Plumbing`, `Electrical`, `HVAC`, `Structural`, `Roofing`, `Appliance`, `Common Area`, `Elevator`, `Pool`, `Generator`, `Security System`, `Pest Control`, `Painting`, `Other` |
| Location | Text | Specific location (e.g., "Master bathroom", "Lobby ceiling") |
| Reported By | Text | Who reported it |
| Reported Date | Date | Date reported |
| Assigned To | Text | Contractor or staff |
| Contractor Phone | Phone | Quick contact |
| Estimated Cost | Number | Estimated cost |
| Actual Cost | Number | Final cost |
| Quote Received | Checkbox | Have we received a formal quote? |
| Quote Amount | Number | Quoted amount |
| Approved | Checkbox | Has the work been approved? |
| Completed Date | Date | When work was finished |
| Warranty | Text | Warranty terms if applicable |
| Photos Before | Files | Photos of the issue |
| Photos After | Files | Photos after completion |
| Notes | Text | Progress updates, follow-ups |
| Related Expense | Relation | → Expenses (link to payment) |

### 6. 🏗️ Works & Projects
Major voted works with staged payment tracking.

| Property | Type | Description |
|----------|------|-------------|
| Project | Title | Project name (e.g., "Roof Repair — Building A") |
| Description | Text | Full scope of work |
| Contractor | Text | Contracted company |
| Quoted Amount | Number | Full contracted price |
| Vote Date | Date | Date owners voted to approve |
| Vote Type | Select | `AGM`, `Electronic Vote`, `Extraordinary Assembly` |
| Vote Result | Text | e.g., "5/7 in favor" |
| Status | Select | `Approved`, `Contractor Selected`, `In Progress`, `Completed`, `On Hold`, `Cancelled` |
| Advance Paid (%) | Number | Percentage paid as advance (e.g., 50) |
| Advance Amount | Number | = Quoted Amount × Advance % |
| Advance Date | Date | When advance was paid |
| Progress Paid (%) | Number | Progress payment percentage |
| Progress Amount | Number | |
| Progress Date | Date | |
| Final Paid (%) | Number | Final payment percentage |
| Final Amount | Number | |
| Final Date | Date | |
| Total Paid | Formula | = Advance + Progress + Final Amount |
| Remaining | Formula | = Quoted Amount − Total Paid |
| Owner Assessment | Number | Total amount called from owners for this work |
| Per-Unit Assessment | Text | Breakdown per unit (e.g., "A-1: $25,000 / A-2: $15,000") |
| Start Date | Date | Work start date |
| Expected Completion | Date | Target completion |
| Actual Completion | Date | Actual completion |
| Warranty Expiry | Date | Contractor warranty end |
| Documents | Files | Contracts, quotes, invoices |
| Notes | Text | Updates and issues |

### 7. 🏦 Cash Position
Track all bank accounts, petty cash, and reserve funds.

| Property | Type | Description |
|----------|------|-------------|
| Account | Title | Account name (e.g., "Operating — Banco Popular", "Petty Cash", "Reserve Fund") |
| Account Number | Text | Bank account number (partial, for reference) |
| Bank | Text | Financial institution |
| Account Type | Select | `Operating`, `Savings`, `Petty Cash`, `Reserve Fund`, `Escrow` |
| Currency | Select | `USD`, `EUR`, `DOP`, `GBP`, `CAD`, `MXN`, `Other` |
| Current Balance | Number | Latest known balance |
| Last Updated | Date | When balance was last verified |
| Signatory | Text | Authorized signers |
| Notes | Text | Access details, restrictions |

### 8. 📨 Communications Log
Full audit trail of all owner/tenant communications.

| Property | Type | Description |
|----------|------|-------------|
| Subject | Title | Communication subject |
| Unit | Relation | → Units (blank for building-wide) |
| Type | Select | `Fee Call`, `Payment Reminder`, `Payment Confirmation`, `Financial Report`, `Violation Notice`, `Meeting Notice`, `Meeting Minutes`, `Work Update`, `Emergency Alert`, `General Notice`, `Legal Notice`, `Welcome Letter`, `Year-End Statement` |
| Channel | Select | `Email`, `WhatsApp`, `Letter`, `In Person`, `Phone`, `Posted Notice` |
| Date | Date | Date of communication |
| Direction | Select | `Sent`, `Received` |
| Content | Text | Full text or summary |
| Attachments | Files | Any documents sent/received |
| Follow-up Required | Checkbox | Needs follow-up? |
| Follow-up Date | Date | When to follow up |
| Follow-up Done | Checkbox | Was follow-up completed? |
| Sent By | Text | Who sent it |

### 9. 📅 Meetings
Board meetings and assemblies.

| Property | Type | Description |
|----------|------|-------------|
| Meeting | Title | Meeting name (e.g., "AGM 2026", "Board Meeting March 2026") |
| Date | Date | Meeting date |
| Type | Select | `AGM (Annual General Meeting)`, `Extraordinary Assembly`, `Board Meeting`, `Committee Meeting` |
| Location | Text | Where held |
| Quorum Met | Checkbox | Was quorum achieved? |
| Attendees | Text | List of attendees by unit |
| Absent | Text | Who was absent |
| Proxies | Text | Proxy delegations |
| Agenda | Text | Meeting agenda |
| Minutes | Text | Full meeting minutes |
| Resolutions | Text | Decisions made with vote counts |
| Documents | Files | Handouts, presentations |
| Next Meeting | Date | Scheduled next meeting |
| Action Items | Text | Tasks assigned with responsible parties |

---

## Accounting Workflows

### 🧮 Quarterly Fee Call

When user says "generate fee call for Q[X] [Year]" or "call the quarterly charges":

1. **Retrieve building data**:
   - Total approved annual budget from Budget database
   - Each unit's ownership share (%) from Units Registry
   
2. **Calculate per-unit amounts**:
   ```
   For each unit:
     quarterly_common = (annual_budget × ownership_%) ÷ 4
     reserve_fund_call = (annual_reserve_target × ownership_%) ÷ 4  [if separate]
     total_call = quarterly_common + reserve_fund_call
   ```

3. **Create ledger entries**:
   For each unit, add to Owner Ledger:
   - Type: `Fee Call`
   - Debit: total_call amount
   - Period: "Q[X] [Year]"
   - Category: `Common Charges`

4. **Update unit balances**:
   ```
   new_balance = current_balance - total_call
   ```
   (Fee call is a debit → reduces balance / increases debt)

5. **Generate fee call letters** for each unit with:
   - Individual amount due
   - Payment deadline
   - Current balance (before and after this call)
   - Payment methods and bank details
   - Previous balance context

6. **Present all letters for user approval** before logging communications.

### 💵 Record Payment

When user says "record payment" or "[Owner/Unit] paid [amount]":

1. **Identify unit and amount**
2. **Create ledger entry**:
   - Type: `Payment Received`
   - Credit: amount
   - Payment method and reference
3. **Update running balance**:
   ```
   new_balance = current_balance + payment_amount
   ```
   (Payment is a credit → increases balance / reduces debt)
4. **Update Fee Status** on Units Registry:
   - If balance ≥ 0 → `Current`
   - If balance < 0 and was overdue → recalculate based on how late
5. **Optional**: Draft payment confirmation to owner
6. **Update Last Payment Date** on unit

### 📊 Monthly Financial Report

When asked for financial report:

1. **Revenue section**:
   - Total fee calls issued this period
   - Total payments received this period
   - Collection rate = payments ÷ calls × 100
   - Outstanding receivables (sum of all negative balances)

2. **Expense section** (from Expenses database):
   - Group by category
   - Show Budget vs Actual per category
   - Flag variances > 10%
   - Total expenses

3. **Cash flow**:
   ```
   Opening balance (all accounts)
   + Payments received
   - Expenses paid
   = Closing balance
   ```

4. **Cash position** (from Cash Position database):
   - Each account current balance
   - Total available funds
   - Reserve fund balance (separate)

5. **Delinquency report**:
   - List of all units with negative balance
   - Days overdue
   - Total outstanding debt
   - Impact analysis: "If all owners were current, available cash would be [X]"

6. **Action items**:
   - Payments to follow up
   - Expenses pending approval
   - Upcoming contractual payments
   - Insurance/contract renewals

### 📋 Owner Individual Statement

When asked for owner statement or account statement:

Generate per-unit statement showing:
```
OWNER ACCOUNT STATEMENT
Unit: [X] | Owner: [Name]
Period: [Start Date] to [End Date]
═══════════════════════════════════════════════════
Opening Balance: [amount]  (positive = credit, negative = owed)

Date       | Description                  | Debit    | Credit   | Balance
-----------+------------------------------+----------+----------+---------
01/01/2026 | Balance brought forward      |          |          | +5,346
15/01/2026 | Q1 2026 Common Charges       | 20,018   |          | -14,672
15/01/2026 | Q1 2026 Reserve Fund         |  3,530   |          | -18,202
20/01/2026 | Payment — Transfer #4521     |          | 23,548   | +5,346
                                                                  
═══════════════════════════════════════════════════
Closing Balance: +5,346.00 (credit — no payment required)

Next expected charge: Q2 2026 — estimated [amount]
```

### 🏗️ Work Provision & Assessment

When a building work is voted:

1. **Record in Works & Projects database**
2. **Calculate per-unit assessment**:
   ```
   For each unit:
     assessment = quoted_amount × ownership_%
   ```
3. **Create ledger entries** for each unit:
   - Type: `Work Assessment`
   - Debit: unit's share
   - Category: `Work Provision`
   - Period: "Work [Name]"
4. **Track contractor payments** with staged schedule:
   - Record advance payment → update Works database
   - Record progress payment → update
   - Record final payment → mark complete
5. **Each contractor payment creates an Expense entry** linked to the project

### 📅 Year-End Closing

When user says "close the fiscal year" or "year-end closing for [Year]":

This is the most critical accounting workflow. Steps:

1. **Calculate actual approved expenses** for the year:
   - Sum all expenses from Expenses database for the fiscal year
   - Present total and breakdown for user approval
   - This total replaces the provisional quarterly charges

2. **Recalculate each owner's share**:
   ```
   actual_share = total_approved_expenses × ownership_%
   ```

3. **Calculate the adjustment** per owner:
   ```
   provisional_charges = sum of all Fee Call debits during the year
   adjustment = actual_share - provisional_charges
   ```
   - If adjustment > 0: owner underpaid → additional debit
   - If adjustment < 0: owner overpaid → credit
   - If adjustment ≈ 0: no entry needed

4. **Create closing ledger entries**:
   - Type: `Year-End Closing Adjustment`
   - Debit or Credit: the adjustment amount
   - Period: "Closing [Year]"

5. **Generate owner statements** ("despues cierre"):
   ```
   Balance at 31/12/[Year] (before closing):  [provisional balance]
   Provisional charges removed:               [sum of quarterly calls]
   Actual approved expenses ([Year]):          [actual_share]
   ─────────────────────────────────────────
   Definitive balance at 31/12/[Year]:         [new balance]
   ```

6. **Carry forward** the definitive balance to the new fiscal year
7. **Present summary** for approval before any entries are created

### 🔍 Financial Audit / Situation Analysis

When user says "audit the finances" or "analyze the financial situation" or "explain the situation to owners":

1. **Cash position audit**:
   - Verify all account balances
   - Total available funds

2. **Receivables audit**:
   - Sum all owner debts
   - Show the single biggest debtor and their impact
   - Calculate: "If [unit] had paid, available cash would be [X]"

3. **Obligations analysis**:
   - Upcoming contractor payments
   - Insurance premiums
   - Regular operating costs for next quarter
   - Total obligations

4. **Gap analysis**:
   ```
   Available funds: [X]
   Total obligations: [Y]
   Surplus / (Deficit): [X - Y]
   ```

5. **Root cause identification**:
   - Is the gap due to delinquency?
   - Is it due to timing (provisions collected but work paid later)?
   - Is it due to budget overrun?

6. **Draft owner communication** explaining the situation:
   - Professional, transparent tone
   - Tables showing cash flow clearly
   - Highlight that paying owners are NOT at fault
   - Show the specific impact of delinquent units
   - Next expected inflows and when the gap resolves
   - Recommend actions (legal, early fee calls, etc.)

---

## Communication Templates

### Fee Call Letter
```
Subject: [Building Name] — Fee Call [Period]

Dear [Owner Name],

Please find below the charges for [Period] for your unit [Unit]:

Common charges ([Ownership %]% of [Budget Amount]):    [Amount]
Reserve Fund contribution:                               [Amount]
───────────────────────────────────────────
TOTAL DUE:                                               [Total]

Your current balance before this call:                    [Balance]
Balance after this call:                                  [New Balance]

Payment deadline: [Date]

Payment methods:
  • Bank transfer: [Bank details]
  • [Other methods]

Please indicate your unit number ([Unit]) in the transfer reference.

If you have already made this payment, please disregard this notice
or send confirmation so we can update our records.

Best regards,
[Building Name] Administration
```

### Financial Situation Report (to owners)
```
Subject: [Building Name] — Financial Situation Report [Date]

Dear Co-owners,

The following is a transparent summary of the condominium's financial 
position as of [Date].

1. OWNER BALANCES (after [latest fee call]):
   ┌──────┬──────────────────┬──────────────┬───────────┐
   │ Unit │ Owner            │ Balance      │ Status    │
   ├──────┼──────────────────┼──────────────┼───────────┤
   │ A-1  │ [Name]           │ -131,044     │ In debt   │
   │ A-2  │ [Name]           │ +406         │ Credit ✅ │
   │ ...  │ ...              │ ...          │ ...       │
   └──────┴──────────────────┴──────────────┴───────────┘

2. CASH POSITION:
   Operating Account:          [Amount]
   Petty Cash:                 [Amount]
   Reserve Fund:               [Amount]
   TOTAL AVAILABLE:            [Total]

3. UPCOMING OBLIGATIONS:
   [List obligations with amounts and dates]

4. ANALYSIS:
   [Clear explanation of surplus or deficit]
   [Root cause if deficit exists]
   [When the situation resolves]
   [Impact of any delinquent units]

5. ACTIONS BEING TAKEN:
   [What administration is doing]

We remain at your disposal for any questions.

[Building Name] Administration
[Date]
```

### Delinquency Notice — Level 1 (Friendly, 1-15 days)
```
Subject: Reminder — [Period] Charges for Unit [X]

Dear [Name],

This is a friendly reminder that the [period] charges of [amount] 
[currency] for Unit [X] appear as unpaid in our records.

Your current balance: [balance] [currency]

If you have recently made the payment, please send us confirmation 
(transfer receipt or reference number) and we will update your account.

Payment details: [bank info]

Thank you for your attention.
[Building Name] Administration
```

### Delinquency Notice — Level 2 (Formal, 16-30 days)
```
Subject: FORMAL NOTICE — Overdue Charges for Unit [X]

Dear [Name],

We wish to inform you that the following charges for Unit [X] 
remain unpaid as of [today's date]:

Period: [period]
Amount due: [amount] [currency]
Days overdue: [days]
Current balance: [balance] [currency]

Per the condominium regulations, late payments may incur:
  • Late fees as established in the building rules
  • Restriction of access to common amenities
  • Legal proceedings for recovery

We kindly request immediate payment or, if you are experiencing 
financial difficulty, to contact us to discuss a payment arrangement.

Payment details: [bank info]

[Building Name] Administration
```

### Delinquency Notice — Level 3 (Warning, 31-60 days)
```
Subject: FINAL WARNING — Urgent: Unpaid Charges Unit [X]

Dear [Name],

Despite our previous communications on [dates of previous notices], 
the following amounts remain outstanding for Unit [X]:

Total outstanding: [total balance] [currency]
Oldest unpaid period: [period]
Days overdue: [days]

This debt directly impacts the condominium's ability to:
  • Pay contractors for essential maintenance
  • Cover insurance premiums
  • Maintain common areas and services

If full payment or a formal payment agreement is not received 
by [deadline — 15 days from now], the Board will be compelled 
to pursue legal remedies available under [local condo law reference].

This is our final attempt at an amicable resolution.

[Building Name] Administration
```

### Delinquency Notice — Level 4 (Pre-Legal, 60+ days)
```
Subject: NOTICE OF INTENT — Legal Proceedings — Unit [X]

To: [Owner full legal name]
Unit: [X], [Building full address]

Dear [Name],

Ref: Outstanding condominium charges — [total amount] [currency]

You are hereby formally notified that the Board of [Building Name] 
has authorized the engagement of legal counsel to pursue recovery 
of the outstanding amount of [total] [currency] owed by Unit [X].

Breakdown of outstanding amounts:
  [Itemized list of each unpaid period and amount]

Previous communications sent:
  [Date] — Friendly reminder (via [channel])
  [Date] — Formal notice (via [channel])
  [Date] — Final warning (via [channel])

Unless full payment is received within [10/15] calendar days of 
this notice, legal proceedings will be initiated without further notice.

All legal costs and fees will be charged to the debtor's account 
as permitted by [local law/regulation reference].

[Building Name] Administration
[Date]

cc: Building Legal Counsel
```

### Year-End Owner Statement
```
Subject: [Building Name] — Year-End Statement [Year] — Unit [X]

Dear [Owner Name],

Following the approval of the [Year] annual accounts at the 
[AGM/Assembly] held on [date], please find your account statement:

INDIVIDUAL ACCOUNT — UNIT [X]
Owner: [Full Name] | Ownership share: [%]%
══════════════════════════════════════════════════

Balance brought forward (31/12/[Year-1]):     [amount]

PAYMENTS RECEIVED IN [Year]:
  [Date] — [Method] — Ref [#]                +[amount]
  [Date] — [Method] — Ref [#]                +[amount]
  ...
  TOTAL PAYMENTS:                             +[total]

APPROVED EXPENSES [Year]:
  Common charges ([%]% of [total budget]):    -[amount]
  [If extraordinary work]: [Work name]        -[amount]
  [If reserve fund]: Reserve Fund             -[amount]
  TOTAL CHARGES:                              -[total]

══════════════════════════════════════════════════
BALANCE AT 31/12/[Year]:                      [balance]
  [If positive]: Credit — will be applied to future charges
  [If negative]: Amount owed — please remit at your earliest convenience

UPCOMING:
  Q1 [Year+1] fee call (estimated):          [amount]
  Balance after Q1 call (estimated):          [amount]
  [If balance covers Q1]: No payment needed until Q2 [Year+1]

Payment details: [bank info]

[Building Name] Administration
```

---

## Guardrails

### Privacy & Security
- **NEVER expose one owner's financial details to another.** Reports for meetings use unit numbers only.
- **NEVER auto-send communications.** Always draft and present for user approval.
- **NEVER include owner balances in tenant communications.**
- **Anonymize delinquent units** in group communications — use "Unit X" not owner names.

### Accounting Integrity
- **NEVER delete ledger entries.** Corrections are made via adjustment entries.
- **Always ask for confirmation** before creating ledger entries, closing years, or modifying balances.
- **Double-check calculations** — present the math before recording.
- **Flag discrepancies** — if numbers don't add up, alert the user before proceeding.
- **Distinguish between common and private charges** in delinquency calculations.

### Legal Boundaries
- **NEVER provide legal advice.** For evictions, liens, lawsuits, always recommend local attorney.
- **Reference local law by name** when drafting legal notices, but add disclaimer.
- **Track the communications audit trail** — every notice sent is logged.

### Operational
- **Currency**: Ask on first use. Support any currency. Remember in MEMORY.md.
- **Date format**: Ask on first use. Support DD/MM/YYYY and MM/DD/YYYY.
- **Language**: Offer bilingual output for multicultural buildings.
- **Fiscal year**: Ask if calendar year or custom. Default to calendar.
- **Fee frequency**: Ask if monthly, quarterly, or annual calls. Default quarterly.
- **Confirm destructive actions**: year-end closing, balance adjustments, deleting entries.

---

## First-Time Setup

Walk the user through:

1. **Notion Integration**: Verify NOTION_API_KEY is set
2. **Database Creation**: Run setup script or create via Notion manually
3. **Building Profile**:
   - Building/complex name and address
   - Number of units
   - Currency and date format
   - Fiscal year (calendar or custom)
   - Fee call frequency (monthly/quarterly/annual)
   - Payment methods accepted
   - Bank account details (for fee call letters)
   - Emergency contacts
   - Management company info (if applicable)
4. **Unit Registration**: For each unit, enter:
   - Unit ID, owner name, contact info
   - Ownership share (%) — MUST total 100%
   - Current status
   - Opening balance (if migrating from existing system)
5. **Budget Setup**: Enter current year's approved budget by category
6. **Cash Position**: Enter current balances for all accounts
7. **Save to MEMORY.md**:
   ```
   ## Condo Manager OS Configuration
   - Building: [name]
   - Address: [address]
   - Units: [count]
   - Currency: [code]
   - Date format: [format]
   - Fiscal year: [Jan-Dec / custom]
   - Fee frequency: [quarterly]
   - Annual budget: [amount]
   - Bank details: [info for letters]
   - Notion databases: [IDs]
   ```

---

## Examples

**"Generate the Q2 2026 fee call"**
→ Calculate each unit's share, create ledger entries, draft individual letters with amounts and balances

**"Unit A-3 paid 25,000 by bank transfer, reference #7821"**
→ Record in ledger, update balance, optionally send confirmation

**"Who owes money?"**
→ Query all units with negative balance, show amounts, days overdue, and total impact on cash

**"Monthly report for February"**
→ Full financial report: income, expenses, cash flow, delinquencies, action items

**"Send reminders to everyone overdue"**
→ Generate severity-appropriate reminders per unit, present for approval

**"The electrician fixed the lobby lights for $350, paid cash from petty cash"**
→ Create expense entry, update petty cash position

**"We voted to repair the roof — contractor quoted 186,000, work starts next month"**
→ Create Works project, calculate per-unit assessments, create ledger entries

**"Close the fiscal year 2025 — approved total expenses were 955,962"**
→ Run full closing: recalculate shares, adjustments, generate definitive owner statements

**"Explain the financial situation to the owners — we have a cash gap"**
→ Audit all accounts, identify root cause, draft transparent report with tables and analysis

**"Generate owner statement for Unit A-5"**
→ Full individual ledger extract with running balance, all transactions, closing balance

**"Prepare for the AGM next Saturday"**
→ Financial summary, maintenance report, delinquency status, budget proposal, draft agenda
