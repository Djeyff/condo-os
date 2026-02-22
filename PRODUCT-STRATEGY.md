# Condo Manager OS — Product Strategy

## Pricing Tiers

### 🆓 Free (ClawHub Discovery)
**Goal:** Maximum installs → funnel to paid
- SKILL.md (full AI instructions — this IS the product for OpenClaw)
- 3 of 10 databases (Units Registry, Budget, Cash Position)
- `setup.js --tier=free` (creates only free DBs)
- `dashboard` command only
- Landing page + demo video
- "Upgrade to Pro → [link]" in every output footer

### 💰 Pro ($149 one-time — Gumroad/Lemon Squeezy)
**Goal:** Sweet spot for small condos (5-20 units)
- All 10 databases + auto-wired relations/formulas
- All 9 CLI commands
- Excel import tool
- Notion template pack (duplicatable workspace)
- Setup video tutorial
- PDF report generation
- Automated payment reminders (cron templates)
- Auto late-fee calculation
- 30-day email support
- Private Discord channel access

### 💎 Enterprise ($249 one-time OR $39/mo)
**Goal:** Property management companies, large condos (20+ units)
- Everything in Pro
- Multi-building support (manage 3+ buildings from one OpenClaw)
- White-label reports (custom logo/branding)
- Owner self-service portal (Telegram/WhatsApp bot for balance inquiries)
- Reserve fund projection calculator
- AGM preparation automation (agenda, proxies, quorum calc)
- Insurance renewal tracking + alerts
- Payment plan management (installments for delinquent owners)
- Priority support (48h response)
- Lifetime updates
- 1-hour onboarding call (optional add-on: +$99)

## Premium Features to Build

### Phase 1 (Ship with Pro launch)
1. **PDF Reports** — `condo-cli.js report --pdf` generates professional PDF
2. **Auto Late Fees** — `condo-cli.js late-fees --rate=2% --grace=15` calculates and posts
3. **Payment Reminders** — Cron templates for escalating reminders
4. **Notion Template Pack** — Pre-built views, dashboards, gallery layouts
5. **Setup Video Script** — 5-min walkthrough

### Phase 2 (Month 2)
6. **Multi-Building** — `config.json` supports array of buildings, CLI switches with `--building=`
7. **Owner Portal Bot** — Telegram bot where owners check their own balance
8. **Reserve Fund Projections** — 5-year projection based on current contributions
9. **AGM Automation** — Generate agenda, track proxies, calculate quorum

### Phase 3 (Month 3)
10. **White-Label** — Custom header/footer on all reports
11. **Payment Plans** — Installment tracking for delinquent owners
12. **Insurance Tracker** — Policy renewals, premium tracking
13. **Document Vault** — kDrive integration for contracts/minutes

## Free vs Pro Feature Matrix

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Units Registry DB | ✅ | ✅ | ✅ |
| Budget DB | ✅ | ✅ | ✅ |
| Cash Position DB | ✅ | ✅ | ✅ |
| Owner Ledger DB | ❌ | ✅ | ✅ |
| Expenses DB | ❌ | ✅ | ✅ |
| Maintenance DB | ❌ | ✅ | ✅ |
| Works & Projects DB | ❌ | ✅ | ✅ |
| Account Movements DB | ❌ | ✅ | ✅ |
| Communications DB | ❌ | ✅ | ✅ |
| Meetings DB | ❌ | ✅ | ✅ |
| Dashboard command | ✅ | ✅ | ✅ |
| Fee calls | ❌ | ✅ | ✅ |
| Payments | ❌ | ✅ | ✅ |
| Statements | ❌ | ✅ | ✅ |
| Financial reports | ❌ | ✅ | ✅ |
| Delinquency tracking | ❌ | ✅ | ✅ |
| Year-end closing | ❌ | ✅ | ✅ |
| Excel import | ❌ | ✅ | ✅ |
| PDF reports | ❌ | ✅ | ✅ |
| Auto late fees | ❌ | ✅ | ✅ |
| Payment reminders | ❌ | ✅ | ✅ |
| Multi-building | ❌ | ❌ | ✅ |
| Owner portal bot | ❌ | ❌ | ✅ |
| White-label | ❌ | ❌ | ✅ |
| Reserve projections | ❌ | ❌ | ✅ |
| AGM automation | ❌ | ❌ | ✅ |
| Payment plans | ❌ | ❌ | ✅ |
| Support | Community | 30-day email | Priority 48h |
| Updates | None | 6 months | Lifetime |

## Sales Funnel

```
ClawHub (free install, 10K+ visibility)
    ↓ "Get full version →"
Landing Page (docs/index.html — hosted on GitHub Pages)
    ↓ CTA buttons
Gumroad/Lemon Squeezy checkout ($149 Pro / $249 Enterprise)
    ↓ After purchase
GitHub private repo access + Discord invite + setup guide
    ↓ Onboarding
Happy customer → testimonials → organic growth
```

## Marketing Channels
1. **ClawHub** — free version for discovery (target: 5K installs month 1)
2. **OpenClaw Discord** — community showcase
3. **Reddit** — r/HOA, r/PropertyManagement, r/Notion, r/selfhosted
4. **LinkedIn** — property management professionals
5. **Facebook Groups** — HOA boards, condo associations
6. **YouTube** — 5-min demo video
7. **Twitter/X** — launch thread
8. **Product Hunt** — launch day
9. **Notion Template Gallery** — cross-promote

## Revenue Projections (Conservative)
- Month 1: 5 Pro sales = $745
- Month 2: 10 Pro + 2 Enterprise = $1,988
- Month 3: 15 Pro + 5 Enterprise = $3,470
- Month 6: 25 Pro/mo + 8 Enterprise/mo = $5,717/mo
- Year 1: ~$40K (conservative) to ~$80K (optimistic)

## Competitive Advantages
1. **AI-native** — not just a template, it's an operating system with an AI brain
2. **Zero manual Notion setup** — one command creates everything
3. **Real-world tested** — built from actual condo management experience
4. **Multilingual** — ES/EN/FR out of the box (most competitors are English-only)
5. **Excel migration** — competitors don't offer data import
6. **Privacy-first** — owner data isolation built into every workflow
7. **Caribbean/LatAm focus** — underserved market, huge demand
8. **Voting system** — per-unit weighted votes with auto-quorum calculation
9. **Owner portal** — Telegram self-service bot (trilingual)
10. **Live dashboards** — 5 auto-refreshing Notion dashboard pages
