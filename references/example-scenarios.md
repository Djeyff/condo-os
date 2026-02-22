# Condo Manager OS — Real-World Accounting Scenarios

These examples show exactly how the system handles common (and complex) situations.
Every scenario is based on actual condo management operations.

---

## Scenario 1: The Full Quarterly Cycle

**Situation**: It's January 1st. Time to call Q1 fees, record payments as they come in,
log expenses, and handle a late payer.

### Step 1: Generate the Q1 Fee Call

You message your agent:
> "Generate the Q1 2026 fee call"

The agent calculates from your Budget and Units Registry:

```
QUARTERLY FEE CALL — Q1 2026
Annual Budget: 800,000 DOP
Reserve Fund: 80,000 DOP/year

Unit  | Owner              | Share  | Common    | Reserve  | TOTAL
──────┼────────────────────┼────────┼───────────┼──────────┼──────────
A-1   | Serge Guerrin      | 12.90% | 25,800.00 | 2,580.00 | 28,380.00
A-2   | Hervé Metayer      |  9.68% | 19,360.00 | 1,936.00 | 21,296.00
A-3   | Frédéric Ondella   |  9.68% | 19,360.00 | 1,936.00 | 21,296.00
A-4   | Patricia Facquet   |  9.68% | 19,360.00 | 1,936.00 | 21,296.00
A-5   | Gernot Engel       | 10.58% | 21,160.00 | 2,116.00 | 23,276.00
A-6   | Karina Santos      | 15.90% | 31,800.00 | 3,180.00 | 34,980.00
A-7   | Jonathan Hazeltine | 24.99% | 49,980.00 | 4,998.00 | 54,978.00
──────┼────────────────────┼────────┼───────────┼──────────┼──────────
TOTAL |                    |100.00% |200,000.00 |20,000.00 |220,000.00
```

The agent then drafts 7 individual fee call letters, each personalized:

```
Estimado Sr. Metayer,

Adjunto encontrará el pedido de fondos del 1er trimestre 2026 para su
Apartamento A-2:

  Gastos comunes (9.68% de 200,000 DOP):    19,360.00 DOP
  Fondo de reserva:                           1,936.00 DOP
  ─────────────────────────────────────────────────────────
  TOTAL A PAGAR:                             21,296.00 DOP

  Su saldo actual antes de este pedido:      +   406.77 DOP (a favor)
  Saldo después del pedido:                  -20,889.23 DOP

  Fecha límite de pago: 15 de enero de 2026

  Datos bancarios: Banco Popular | Cta 0839787280
  Titular: Sra. Yunairy Encarnacion
  Referencia: indicar "A-2" en el concepto

La Administración — Condominio El Framboyant
```

**Ledger entries created** (one per unit):
```
Owner Ledger:
  Entry: "A-2 — Q1 2026 Common Charges"
  Unit: A-2
  Date: 2026-01-01
  Type: Fee Call
  Debit: 21,296.00
  Credit: —
  Balance After: -20,889.23
  Period: Q1 2026
  Category: Common Charges
```

### Step 2: Record Payments as They Arrive

Over the next two weeks:

> "A-2 paid 21,296 by bank transfer, ref #4521, January 8th"

```
✅ Payment recorded for A-2:
  Credit: 21,296.00 DOP
  Balance: -20,889.23 + 21,296.00 = +406.77 DOP (credit)
  Fee Status: Current ✅
```

> "A-5 paid 23,276 cash today"

```
✅ Payment recorded for A-5:
  Credit: 23,276.00 DOP
  Balance: -20,197.00 + 23,276.00 = +3,079.00 DOP (credit)
  Fee Status: Current ✅
```

> "A-7 paid 55,000 by transfer ref #7892" (overpaid slightly)

```
✅ Payment recorded for A-7:
  Credit: 55,000.00 DOP
  Balance: -46,430.20 + 55,000.00 = +8,569.80 DOP (credit)
  Note: Overpayment of 22.00 DOP — credit will carry forward
  Fee Status: Current ✅
```

### Step 3: Handle a Late Payer

Day 16 — A-1 hasn't paid. The agent flags it in the daily briefing:

```
🔔 DAILY BRIEFING — January 16, 2026

⚠️ OVERDUE PAYMENTS:
  A-1 (Serge Guerrin): -159,424.38 DOP — 16 days overdue
  Previous balance was already negative (-131,044.38)
  Last payment received: August 2025
  Recommended action: FORMAL NOTICE (Level 2)

✅ All other units: paid and current
```

You say: "Send formal reminder to A-1"

The agent drafts a Level 2 notice and logs it in Communications:
```
Communications Log entry:
  Subject: "AVISO FORMAL — Cuotas pendientes Apto A-1"
  Type: Payment Reminder
  Channel: Email
  Date: 2026-01-16
  Direction: Sent
  Follow-up Required: ✅
  Follow-up Date: 2026-01-31
```

### Step 4: Log an Expense

> "Paid EDENORTE 12,500 for electricity, from the bank account, invoice #EN-2026-0142"

```
✅ Expense recorded:
  Description: EDENORTE — Electricity
  Amount: 12,500.00 DOP
  Category: Utilities
  Vendor: EDENORTE
  Paid From: Operating Account
  Invoice: EN-2026-0142
  Quarter: Q1
  Budget line: Electricity — Common Areas
    Q1 Budget: 15,000 | Q1 Actual so far: 12,500 | Status: On Track ✅
```

---

## Scenario 2: Year-End Closing (The Big One)

**Situation**: The fiscal year is ending. The annual meeting approved total expenses
of 955,962 DOP. Time to close the books.

You say: "Close fiscal year 2025. Approved total expenses: 955,962.03 DOP"

### The Agent's Process:

**Step 1: Gather the numbers**

```
YEAR-END CLOSING — 2025

PROVISIONAL vs DEFINITIVE COMPARISON:

Unit  | Share   | Provisional Calls | Definitive Share | Adjustment
──────┼─────────┼───────────────────┼──────────────────┼───────────
A-1   | 12.90%  | 142,280.32        | 123,319.10       | -18,961.22 (CREDIT)
A-2   |  9.68%  |  93,315.06        |  92,537.12       |    -777.94 (CREDIT)
A-3   |  9.68%  |  93,315.06        |  92,537.12       |    -777.94 (CREDIT)
A-4   |  9.68%  |  93,315.06        |  92,537.12       |    -777.94 (CREDIT)
A-5   | 10.58%  | 101,994.50        | 101,140.78       |    -853.72 (CREDIT)
A-6   | 15.90%  | 152,991.96        | 151,997.96       |    -994.00 (CREDIT)
A-7   | 24.99%  | 240,488.04        | 238,894.91       |  -1,593.13 (CREDIT)
──────┼─────────┼───────────────────┼──────────────────┼───────────
TOTAL | 100.00% | 917,700.00        | 955,962.03*      |

* Note: Provisional calls (917,700) were based on the budget estimate.
  Actual approved (955,962.03) includes extraordinary items.
  However, extraordinary assessments were called SEPARATELY via work
  provisions, so the adjustment accounts for the difference between
  regular quarterly calls and the approved common charges only.
```

**Step 2: Calculate definitive balances**

```
DEFINITIVE OWNER BALANCES — 31/12/2025

Unit  | Balance 31/12/24 | Payments 2025 | Approved Share | NEW BALANCE
──────┼──────────────────┼───────────────┼────────────────┼────────────
A-1   |     -20,318.08   |    32,215.65  |   123,319.10   | -111,421.53 ❌
A-2   |      -3,003.52   |    95,947.41  |    92,537.12   |     +406.77 ✅
A-3   |      -6,044.59   |   103,928.54  |    92,537.12   |   +5,346.83 ✅
A-4   |      -4,483.43   |   101,181.00  |    92,537.12   |   +4,160.45 ✅
A-5   |      -3,803.44   |   108,023.42  |   101,140.78   |   +3,079.20 ✅
A-6   |      -6,090.65   |   163,121.14  |   151,997.96   |   +5,032.53 ✅
A-7   |      -9,249.79   |   256,692.50  |   238,894.91   |   +8,547.80 ✅
```

**Step 3: Generate individual year-end statements**

For each owner, the agent creates a statement in the Framboyant style:

```
══════════════════════════════════════════════════════════════════
ESTADO DE CUENTA INDIVIDUAL — CIERRE DEFINITIVO 2025
Condominio El Framboyant
══════════════════════════════════════════════════════════════════

Apartamento: A-3
Copropietario: Sr. Frédéric ONDELLA
Cuota parte: 9.68%

Fecha       | Concepto                              | Débito    | Crédito   | Saldo
────────────┼───────────────────────────────────────┼───────────┼───────────┼──────────
01/01/2025  | Saldo ejercicio anterior              |           |           | -6,044.59
15/01/2025  | Pago — Transferencia #3291            |           | 25,482.13 | +19,437.54
01/04/2025  | Pago — Transferencia #3455            |           | 25,482.13 | +44,919.67
15/07/2025  | Pago — Transferencia #3612            |           | 25,482.14 | +70,401.81
01/10/2025  | Pago — Transferencia #3788            |           | 27,482.14 | +97,883.95
            |                                       |           |           |
31/12/2025  | Gastos Total 2025 (Aprobado AGO       |           |           |
            | 16/02/2026) — 9.68% de 955,962.03     | 92,537.12 |           | +5,346.83
══════════════════════════════════════════════════════════════════
SALDO DEFINITIVO AL 31/12/2025:              +5,346.83 DOP (A FAVOR)

→ Este saldo a favor será aplicado al pedido del 1er trimestre 2026.
→ No se requiere pago adicional hasta que el crédito se agote.

Próximo pedido estimado (Q1 2026): 21,296.00 DOP
Saldo estimado después del Q1 2026: +5,346.83 - 21,296.00 = -15,949.17 DOP
```

**Step 4: Confirmation**

```
⚠️ YEAR-END CLOSING SUMMARY — Please confirm:

  Fiscal year: 2025
  Approved expenses: 955,962.03 DOP
  Adjustment entries to create: 7
  
  Owners with credit (no action needed): A-2 through A-7
  Owners with debt: A-1 (-111,421.53 common + -106,935.00 private = -218,356.53 total)

  Shall I proceed with creating the ledger entries and generating all 7 statements?
```

---

## Scenario 3: Cash Gap Analysis & Owner Communication

**Situation**: You realize there's not enough cash to pay contractors and insurance.
You need to understand why and explain it to the owners.

You say: "Audit the finances. We might have a cash problem."

### The Agent's Analysis:

```
══════════════════════════════════════════════════════════════════
FINANCIAL AUDIT — February 2026
══════════════════════════════════════════════════════════════════

1. CASH POSITION (verified)
   ┌─────────────────────────┬──────────────┐
   │ Operating Account       │  167,016.80  │
   │ Petty Cash              │   39,217.74  │
   │ Reserve Fund            │   67,651.49  │
   ├─────────────────────────┼──────────────┤
   │ TOTAL AVAILABLE         │  273,886.03  │
   └─────────────────────────┴──────────────┘

2. OBLIGATIONS
   ┌─────────────────────────────────────┬──────────────┐
   │ Roof Repair A — 70% advance        │  130,200.00  │
   │ Roof Repair B — 70% advance        │   35,280.00  │
   │ Roof Repair A — 30% remaining      │   55,800.00  │
   │ Roof Repair B — 30% remaining      │   15,120.00  │
   │ Insurance Q1 payment               │   47,249.18  │
   │ Routine operating expenses (est.)  │   15,000.00  │
   ├─────────────────────────────────────┼──────────────┤
   │ TOTAL OBLIGATIONS                  │  298,649.18  │
   └─────────────────────────────────────┴──────────────┘

3. GAP ANALYSIS
   ┌─────────────────────────────────────┬──────────────┐
   │ Available                          │  273,886.03  │
   │ Obligations                        │ -298,649.18  │
   ├─────────────────────────────────────┼──────────────┤
   │ DEFICIT                            │  -24,763.15  │
   └─────────────────────────────────────┴──────────────┘

4. ROOT CAUSE
   ┌─────────────────────────────────────────────────────┐
   │ The deficit is caused by A-1's outstanding debt:    │
   │                                                     │
   │   A-1 common charges owed:    131,044.38 DOP        │
   │   A-1 private charges:        106,935.00 DOP        │
   │   TOTAL A-1 debt:             237,979.38 DOP        │
   │                                                     │
   │   If A-1 had paid common charges alone:             │
   │   273,886.03 + 131,044.38 = 404,930.41             │
   │   404,930.41 - 298,649.18 = +106,281.23 SURPLUS    │
   │                                                     │
   │   ➡ Without A-1's debt, there would be NO deficit  │
   └─────────────────────────────────────────────────────┘

5. RESOLUTION TIMELINE
   ┌─────────────────────────────────────────────────────┐
   │ Q1 2026 fee call: all A2-A7 owners have credits    │
   │ that absorb the Q1 call → NO CASH enters           │
   │                                                     │
   │ Q2 2026 fee call (~June): credits exhausted,       │
   │ owners pay in cash → ~105,914 DOP expected         │
   │                                                     │
   │ Gap covers itself by: ~June 2026                   │
   │ Legal action on A-1: In progress (privilege filed) │
   └─────────────────────────────────────────────────────┘

6. RECOMMENDED ACTIONS
   • Negotiate 30% contractor holdback to delay final payment
   • Consider advancing Q2 fee call by 1 month
   • Continue legal proceedings against A-1
   • Draft transparent communication to owners explaining situation
```

You say: "Draft the owner communication explaining this"

The agent produces a formal letter with the cash flow table, root cause, timeline, and reassurance — exactly like the Framboyant financial notes you've seen.

---

## Scenario 4: Daily Operations — A Typical Week

### Monday — Morning Briefing
```
🔔 DAILY BRIEFING — Monday, March 3, 2026

🔧 MAINTENANCE:
  • Pool pump repair — assigned to TechPool, estimated 15,000 DOP (Day 3)
  • Lobby light replacement — completed Friday, cost: 2,800 DOP

💰 OVERDUE:
  • A-1: -159,424.38 DOP — 62 days overdue — Level 3 reminder sent Feb 15
    → Recommended: Escalate to Level 4 (pre-legal notice)

📋 FOLLOW-UPS DUE TODAY:
  • Respond to A-4's question about parking space assignment
  • Confirm insurance renewal documents received

💵 PENDING APPROVALS:
  • Gardening service — 8,500 DOP — awaiting your approval

🏦 CASH POSITION: 156,234.50 DOP (Operating + Petty Cash)
   Reserve Fund: 67,651.49 DOP
   ⚠️ Operating cash below 2-month threshold
```

### Tuesday — Expense Entry
> "Paid the gardener 8,500, cash from petty cash"
> "Paid CORAASAN water bill 4,200, transfer from bank, invoice W-2026-03"

### Wednesday — Maintenance
> "A-4 reports water leak in their bathroom ceiling — seems urgent"

```
🔧 MAINTENANCE REQUEST CREATED:
  Request: Water leak — bathroom ceiling
  Unit: A-4 (Patricia Facquet)
  Priority: HIGH 🟠 (water damage risk — auto-classified)
  Status: New
  Category: Plumbing
  Recommended: Call plumber immediately — water leaks can cause structural damage
  Plumber on file: Juan Martinez — 829-555-1234

  Shall I draft a notification to the owner confirming we received the report?
```

### Thursday — Payment Received
> "A-6 paid 35,000 by transfer, reference TRF-20260304"

### Friday — Quick Check
> "How are we doing this week?"

```
📊 WEEKLY SNAPSHOT — Week of March 3, 2026

  Payments received: 35,000 DOP (A-6)
  Expenses paid: 12,700 DOP (gardening + water)
  Net cash flow: +22,300 DOP

  Collection status: 6/7 units current, A-1 remains delinquent
  Maintenance: 1 new (A-4 leak — HIGH), 1 in progress (pool pump)
  
  Cash position: 178,534.50 DOP
```

---

## Scenario 5: Major Work — Full Lifecycle

### Phase 1: Vote & Assessment

> "The owners voted to repair the main roof. Contractor: Techos del Caribe.
> Quote: 186,000 DOP. Vote date: April 19, 2025. Result: 5/7 in favor."

```
🏗️ WORK PROJECT CREATED:
  Project: Roof Repair — Main Building
  Contractor: Techos del Caribe
  Quoted: 186,000.00 DOP
  Vote: April 19, 2025 — Approved (5/7)

  PER-UNIT ASSESSMENT:
  ┌──────┬──────────┬────────────────┐
  │ Unit │  Share   │  Assessment    │
  ├──────┼──────────┼────────────────┤
  │ A-1  │  12.90%  │   23,994.00   │
  │ A-2  │   9.68%  │   18,004.80   │
  │ A-3  │   9.68%  │   18,004.80   │
  │ A-4  │   9.68%  │   18,004.80   │
  │ A-5  │  10.58%  │   19,678.80   │
  │ A-6  │  15.90%  │   29,574.00   │
  │ A-7  │  24.99%  │   46,481.40   │ 
  ├──────┼──────────┼────────────────┤
  │TOTAL │ 100.00%  │  186,000.00*  │
  └──────┴──────────┴────────────────┘
  * Includes 10% admin honorarios: 168,000 contractor + 18,000 admin

  Create ledger entries for all 7 units? (Work Assessment debits)
```

### Phase 2: Contractor Payments

> "Paid Techos del Caribe 50% advance today, 84,000 from operating account"

```
✅ CONTRACTOR PAYMENT RECORDED:
  Works & Projects: Roof Repair — Main Building
    Advance: 50% = 84,000.00 DOP ✅
    Progress: —
    Final: —
    Total paid: 84,000.00 / 168,000.00 (50%)
    Remaining: 84,000.00 DOP

  Expense entry created:
    Description: Techos del Caribe — Roof Repair advance 50%
    Amount: 84,000.00 DOP
    Category: Capital Works
    Is Extraordinary: ✅
```

### Phase 3: Progress & Completion

> "Roof is 70% done. Pay the 20% progress payment: 33,600"

> "Roof is complete, inspector approved. Pay the final 30%: 50,400"

```
✅ PROJECT COMPLETED:
  Roof Repair — Main Building
  ┌──────────────────┬──────────────┐
  │ Advance (50%)    │   84,000.00  │
  │ Progress (20%)   │   33,600.00  │
  │ Final (30%)      │   50,400.00  │
  ├──────────────────┼──────────────┤
  │ TOTAL PAID       │  168,000.00  │
  │ Quoted           │  168,000.00  │
  │ Variance         │        0.00  │
  └──────────────────┴──────────────┘
  Status: COMPLETED ✅
  Warranty: [Enter warranty terms]
```

---

## Scenario 6: Building a Payment Plan

> "A-1 wants to set up a payment plan for their 131,000 debt. 
> They can pay 15,000 per month."

```
📋 PAYMENT PLAN PROPOSAL — Unit A-1

  Total debt (common charges only): 131,044.38 DOP
  Proposed monthly payment: 15,000.00 DOP
  Plan duration: 9 months (last payment: 11,044.38)

  Schedule:
  ┌──────────┬────────────┬──────────────┐
  │ Month    │ Payment    │ Remaining    │
  ├──────────┼────────────┼──────────────┤
  │ Month 1  │ 15,000.00  │ 116,044.38  │
  │ Month 2  │ 15,000.00  │ 101,044.38  │
  │ Month 3  │ 15,000.00  │  86,044.38  │
  │ Month 4  │ 15,000.00  │  71,044.38  │
  │ Month 5  │ 15,000.00  │  56,044.38  │
  │ Month 6  │ 15,000.00  │  41,044.38  │
  │ Month 7  │ 15,000.00  │  26,044.38  │
  │ Month 8  │ 15,000.00  │  11,044.38  │
  │ Month 9  │ 11,044.38  │       0.00  │
  └──────────┴────────────┴──────────────┘

  ⚠️ NOTE: This plan covers EXISTING debt only. New quarterly
  charges will continue to accrue. A-1 must also pay current
  quarters on time, or the plan is void.

  ⚠️ RECOMMENDATION: Have this plan signed by both parties and
  reviewed by legal counsel. This is an administrative arrangement,
  not a legal contract. Consult your attorney.

  Update A-1's Fee Status to "Payment Plan"?
  Draft formal payment plan agreement letter?
```

---

## Scenario 7: Multi-Building / Portfolio View

For managers with 2+ buildings:

> "Show me the status across all my buildings"

```
📊 PORTFOLIO OVERVIEW — February 2026

Building             | Units | Collection | Cash    | Issues
─────────────────────┼───────┼────────────┼─────────┼────────────
El Framboyant        |   7   |   85.7%    | 178K    | A-1 delinquent
CoralStone Phase 1   |  12   |  100.0%    | 445K    | None ✅
Las Palmeras         |  20   |   95.0%    | 892K    | Unit 15 (30 days)
─────────────────────┼───────┼────────────┼─────────┼────────────
TOTAL                |  39   |   94.9%    | 1,515K  | 2 delinquent

⚠️ Priority attention: El Framboyant — cash gap, see audit report
```

*(Each building would have its own set of 9 databases, and the skill handles them independently based on which building context you're working in.)*
