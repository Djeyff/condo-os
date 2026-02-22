# Condo Manager OS — Accounting & Operations Reference

## 1. Condo Accounting Fundamentals

### How Condo Finances Work

A condominium is jointly owned. Each unit has an **ownership share** (called "tantièmes" in French systems, "coeficiente" in Spanish, or simply "percentage") that determines:
- How much of the common expenses each owner pays
- Their voting weight in assemblies
- Their share of the reserve fund

**The accounting cycle:**
```
Annual Budget approved → Quarterly fee calls → Expenses paid → Year-end closing
     ↓                        ↓                      ↓              ↓
  Categories &          Each owner pays          Tracked by       Provisional charges
  amounts set          their % share            category          replaced by actuals
```

### Credit vs Debit (Owner Account Perspective)

| Action | Effect | Example |
|--------|--------|---------|
| Fee call issued | DEBIT (reduces balance) | Q1 call of $5,000 → balance goes from +2,000 to -3,000 |
| Payment received | CREDIT (increases balance) | Owner pays $5,000 → balance goes from -3,000 to +2,000 |
| Work assessment | DEBIT | Roof repair share of $25,000 → debited to owner |
| Year-end credit | CREDIT | Owner overpaid by $500 → credited |
| Late fee | DEBIT | $100 penalty → debited |
| Refund | CREDIT | Overpayment returned → credited |

**Convention**: Positive balance = owner has credit (overpaid). Negative balance = owner owes money.

### The Year-End Closing Process

This is the most important accounting event. Here's exactly what happens:

**During the year (provisional):**
- Budget is approved at the AGM
- Quarterly calls are calculated: `quarterly_call = annual_budget / 4 × ownership_%`
- These are PROVISIONAL — they assume expenses will match budget exactly

**At year-end (definitive):**
1. Total actual expenses are calculated from the Expenses database
2. Each owner's definitive share = `actual_total_expenses × ownership_%`
3. Difference from provisional = `definitive_share - sum_of_quarterly_calls`
4. This difference is recorded as an adjustment entry
5. Carries forward to next year

**Example:**
```
Budget approved:        1,000,000
Owner A share (15%):    150,000 → Quarterly calls: 4 × 37,500 = 150,000
Actual expenses:        955,962
Owner A definitive:     955,962 × 15% = 143,394
Adjustment:             143,394 - 150,000 = -6,606 (CREDIT — owner overpaid)
```

### Extraordinary Works

When the building votes for a major project (roof, elevator, etc.):

1. **Vote**: Owners approve the work at an assembly
2. **Assessment**: Each owner is charged their percentage of the quoted amount
3. **Collection**: Assessment appears as a debit in the owner's ledger
4. **Contractor payments**: Usually staged:
   - 50% advance before work starts
   - 20% progress payment at midpoint
   - 30% final payment after completion/inspection
5. **Reconciliation**: If final cost ≠ quoted amount, adjustment entries are made

### Reserve Fund

The reserve fund is money set aside for future major repairs. Best practices:
- Separate bank account (not mixed with operating funds)
- Annual contribution = 10-15% of operating budget
- Each owner's contribution = reserve_target × ownership_%
- Only used for capital improvements, not routine expenses
- Board approval required for any withdrawal

---

## 2. Financial Health Metrics

### Key Performance Indicators

| Metric | Formula | Target | Warning |
|--------|---------|--------|---------|
| Collection Rate | Payments received ÷ Fees called | >95% | <85% |
| Expense Ratio | Total expenses ÷ Total income | <80% | >95% |
| Reserve Ratio | Reserve fund ÷ Annual budget | >25% | <10% |
| Delinquency Rate | Units overdue ÷ Total units | <10% | >20% |
| Cash Months | Available cash ÷ Monthly expenses | >3 months | <1 month |
| Maintenance Backlog | Open requests > 14 days | 0 | >5 |
| Budget Variance | (Actual - Budget) ÷ Budget | ±5% | >15% |

### Cash Flow Warning Signs

🔴 **Critical** (act immediately):
- Cash < 1 month expenses
- Cannot pay contractor obligations
- Insurance payment at risk

🟠 **Warning** (act this week):
- One delinquent owner represents >30% of expected income
- Reserve fund below 10% of annual budget
- 3+ months of negative cash flow trend

🟡 **Watch** (monitor monthly):
- Collection rate below 90%
- Budget variance >10% in any category
- 2+ units overdue simultaneously

---

## 3. Delinquency Escalation Protocol

### Timeline & Actions

| Days Overdue | Action | Communication Level | Template |
|-------------|--------|-------------------|----------|
| 1-5 | Grace period | None | — |
| 6-15 | First contact | Friendly reminder | Level 1 |
| 16-30 | Formal notice | Professional, firm | Level 2 |
| 31-45 | Written warning | Consequences stated | Level 3 |
| 46-60 | Final notice | Pre-legal language | Level 4 |
| 61-90 | Board review | Board decides on legal action | Internal |
| 90+ | Legal proceedings | Attorney engaged | Legal counsel |

### Impact Analysis Template

When presenting delinquency impact to owners:

```
DELINQUENCY IMPACT ANALYSIS

Total available cash:                    [A]
Total outstanding debt (all units):      [B]

If all owners were current:
  Available cash would be:               [A + B]
  All obligations could be met:          ✅ / ❌

Largest single debtor:
  Unit [X]: owes [amount]
  This represents [%] of total receivables
  Impact: Without this payment, [specific consequence]

Timeline to resolution:
  Next expected inflow: [Q date — amount]
  Gap covered by: [date]
  Actions underway: [legal/payment plan/etc.]
```

---

## 4. Maintenance Priority Matrix

| Priority | Response Time | Examples |
|----------|--------------|---------|
| Emergency 🔴 | < 1 hour | Water main break, gas leak, electrical fire, security breach, sewage, structural danger |
| High 🟠 | < 24 hours | AC failure (hot climate), no hot water, major appliance, pest infestation, roof leak |
| Medium 🟡 | 3-5 days | Minor leak, broken window (non-security), faulty outlet, appliance malfunction |
| Low 🟢 | 2 weeks | Cosmetic, light fixtures, paint touch-up, minor improvements, non-urgent landscaping |

### Common Area Inspection Schedule

**Weekly**: Pool chemistry, elevator, parking lot, security cameras, general cleanliness, fire exits
**Monthly**: Generator test, water tanks, emergency lights, gate systems, landscaping, drainage
**Quarterly**: Fire equipment, pest control, HVAC service, plumbing inspection, roof/gutters, insurance review
**Annual**: Full building inspection, insurance renewal, budget prep, vendor contract renewals, reserve assessment

---

## 5. Meeting Templates

### AGM Agenda Structure

1. Call to Order — Quorum verification (typically >50% of ownership shares)
2. Appointment of Secretary for the meeting
3. Approval of Previous AGM Minutes
4. **Financial Report** — Presentation of annual accounts
5. **Approval of Accounts** — Vote to approve actual expenses
6. **Delinquency Report** — Status update (unit numbers only, no names)
7. **Maintenance Report** — Completed and pending work
8. **Budget Approval** — Proposed budget for next fiscal year, vote
9. **Special Projects** — Proposed works, quotes, votes
10. **Board Elections** (if applicable)
11. **Open Discussion** — Owner concerns and questions
12. **Next Meeting** — Set date
13. Adjournment

### Quorum Rules (varies by jurisdiction)

- **First call**: Typically >50% of ownership shares present or by proxy
- **Second call**: Often 25-33%, or any number present
- **Simple majority**: >50% of votes present for routine decisions
- **Qualified majority**: 2/3 or 3/4 for major works, rule changes, or loans

---

## 6. Legal Reference (Jurisdiction-Dependent)

⚠️ **DISCLAIMER**: This is general reference only. Laws vary by country, state, and municipality. Always consult a local attorney for legal matters.

### Common Condo Law Topics
- Owner rights and obligations
- Common area responsibilities
- Fee collection and penalties
- Lien/privilege registration for unpaid fees
- Eviction of tenants (different from eviction of owners)
- Building insurance requirements
- Assembly/meeting requirements and quorum
- Board powers and limitations
- Financial audit requirements
- Reserve fund rules

### Document Retention Guidelines
- Financial records: minimum 7 years
- Meeting minutes: permanent
- Contracts: duration + 3-5 years
- Insurance policies: permanent (at least current + prior)
- Owner communications: minimum 3 years
- Maintenance records: permanent (especially structural)
- Legal correspondence: permanent

---

## 7. Multilingual Support Notes

### Common Property Management Terms

| English | Spanish | French | Portuguese |
|---------|---------|--------|------------|
| Common charges | Gastos comunes / Cuotas | Charges communes | Taxas condominiais |
| Owner | Propietario / Copropietario | Copropriétaire | Condômino |
| Tenant | Inquilino | Locataire | Inquilino |
| Maintenance | Mantenimiento | Entretien | Manutenção |
| Annual meeting | Asamblea General | Assemblée Générale | Assembleia Geral |
| Budget | Presupuesto | Budget | Orçamento |
| Reserve fund | Fondo de reserva | Fonds de réserve | Fundo de reserva |
| Fee call | Pedido de fondos | Appel de fonds | Chamada de capital |
| Delinquent | Moroso | En retard | Inadimplente |
| Work provision | Provisión para trabajos | Provision pour travaux | Provisão para obras |
| Minutes | Acta | Procès-verbal | Ata |
| Ownership share | Porcentaje / Tantièmes | Tantièmes / Millièmes | Fração ideal |
| Lien/privilege | Privilegio | Privilège | Hipoteca legal |
| Late fee | Penalidad por mora | Pénalité de retard | Multa por atraso |
