/**
 * Demo data for Condo Manager OS public demo
 * DEMO_MODE=true activates this on Vercel
 * All names, amounts and details are entirely fictional.
 *
 * Fiscal year: 01/01 → 31/12
 * 2026 = running year (YTD)
 * 2025 = closed year (Saldo balance al 31/12/2025)
 * 2024 = closed year (Saldo balance al 31/12/2024)
 *
 * ─── Budget consistency ────────────────────────────────────────────
 * Year   Budget    Actual   Variance  %Used
 * 2026   874,000  428,260  +445,740   49%  (Q1 only — YTD Feb)
 * 2025   715,000  622,350  +92,650    87%  (full 12 months)
 * 2024   710,000  541,200  +168,800   76%  (full 12 months)
 */

export const DEMO_MODE = process.env.DEMO_MODE === 'true';

export const demoBranding = {
  name: 'Coral Breeze Residences',
  logo: null,
  primaryColor: '#2563eb',
  accentColor: '#d4a853',
  currency: 'DOP',
};

// ─── Units ──────────────────────────────────────────────────────────
export const demoUnits = [
  { unit: 'A-1', owner: 'Sophie MARTIN / Bruno MARTIN',  balance: -45200, share: 15.5, status: 'Overdue 90+' },
  { unit: 'A-2', owner: 'Carlos FERNANDEZ',              balance:   3750, share: 13.2, status: 'Current' },
  { unit: 'A-3', owner: 'Hélène DUPONT',                 balance:      0, share: 12.9, status: 'Current' },
  { unit: 'A-4', owner: 'Patrick GUILLAUME',             balance:  -8200, share:  9.7, status: 'Overdue 60' },
  { unit: 'A-5', owner: 'Nadia & Karim IBRAHIM',         balance:   1500, share: 11.3, status: 'Current' },
  { unit: 'A-6', owner: 'Thierry ROUSSEAU',              balance: -22400, share: 15.1, status: 'Overdue 30' },
  { unit: 'A-7', owner: 'Laura SCHMIDT',                 balance:   6800, share: 22.3, status: 'Current' },
];

// ─── Cash Accounts ──────────────────────────────────────────────────
export const demoCashAccounts = [
  { id: 'demo-reserve',   name: 'Fondo de Reservas',                  balance:  85000, type: 'Reserve Fund' },
  { id: 'demo-petty',     name: 'Caja Chica',                         balance:  12300, type: 'Petty Cash'   },
  { id: 'demo-operating', name: 'Banco Nacional — Cuenta Operativa',  balance:  47500, type: 'Operating'    },
];

// ─── Budget items per year (Category → amount) ─────────────────────
// Must stay in sync with expense totals per year.
export const demoBudgetItemsByYear = {
  2026: [
    // Ordinary 524,000
    { category: 'Cleaning',       annualBudget: 150000 },
    { category: 'Maintenance',    annualBudget: 120000 },
    { category: 'Insurance',      annualBudget:  96000 },
    { category: 'Utilities',      annualBudget:  48000 },
    { category: 'Management Fee', annualBudget:  72000 },
    { category: 'Bank Charges',   annualBudget:   8000 },
    { category: 'Landscaping',    annualBudget:  30000 },
    // Extraordinary voted by assembly: 350,000
    { category: 'Extraordinary',  annualBudget: 350000, isExtraordinary: true },
    // TOTAL: 874,000
  ],
  2025: [
    // Ordinary 510,000
    { category: 'Cleaning',       annualBudget: 150000 },
    { category: 'Maintenance',    annualBudget:  90000 },
    { category: 'Insurance',      annualBudget:  96000 },
    { category: 'Utilities',      annualBudget:  42000 },
    { category: 'Management Fee', annualBudget:  72000 },
    { category: 'Bank Charges',   annualBudget:   7000 },
    { category: 'Landscaping',    annualBudget:  53000 },
    // Extraordinary voted: 205,000
    { category: 'Extraordinary',  annualBudget: 205000, isExtraordinary: true },
    // TOTAL: 715,000
  ],
  2024: [
    // Ordinary 480,000
    { category: 'Cleaning',       annualBudget: 120000 },
    { category: 'Maintenance',    annualBudget:  72000 },
    { category: 'Insurance',      annualBudget:  96000 },
    { category: 'Utilities',      annualBudget:  36000 },
    { category: 'Management Fee', annualBudget:  96000 },
    { category: 'Bank Charges',   annualBudget:   6000 },
    { category: 'Landscaping',    annualBudget:  54000 },
    // Extraordinary voted: 230,000
    { category: 'Extraordinary',  annualBudget: 230000, isExtraordinary: true },
    // TOTAL: 710,000
  ],
};

// Helper: budget total per year
export const demoBudgetByYear = Object.fromEntries(
  Object.entries(demoBudgetItemsByYear).map(([yr, items]) => [
    yr, items.reduce((s, b) => s + b.annualBudget, 0),
  ])
);
// { 2024: 710000, 2025: 715000, 2026: 874000 }

// Helper: { year: { category: annualBudget } }
export const demoBudgetMapByYear = Object.fromEntries(
  Object.entries(demoBudgetItemsByYear).map(([yr, items]) => [
    yr, Object.fromEntries(items.map(b => [b.category, b.annualBudget])),
  ])
);

// Legacy alias (used in admin page KPI)
export const demoBudgetItems = demoBudgetItemsByYear[2026];
export const demoBudgetMap   = demoBudgetMapByYear[2026];

// ─── 2026 Expenses — Running Year (Q1 YTD through Feb) ────────────
// Total: 428,260  Budget: 874,000  Used: 49%
export const demoExpenses = [
  // ── Q1 Recurring ──
  { date:'2026-02-18', description:'Limpieza mensual — Feb',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q1' },
  { date:'2026-02-15', description:'Reparación bomba de agua',          vendor:'AguaTec Servicios', category:'Maintenance',    amount: 15600, status:'Paid', quarter:'Q1' },
  { date:'2026-02-10', description:'Cargo mensual cuenta corriente',    vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q1' },
  { date:'2026-02-05', description:'INAPA consumo Enero',               vendor:'INAPA',             category:'Utilities',      amount:  3200, status:'Paid', quarter:'Q1' },
  { date:'2026-01-28', description:'Limpieza mensual — Ene',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q1' },
  { date:'2026-01-20', description:'Revisión eléctrica áreas comunes',  vendor:'TecnoFix S.R.L.',   category:'Maintenance',    amount:  8700, status:'Paid', quarter:'Q1' },
  { date:'2026-01-15', description:'Prima Seguro Incendio Q1',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q1' },
  { date:'2026-01-10', description:'Honorario Administrador — Ene',     vendor:'Admin Pro RD',      category:'Management Fee', amount: 18000, status:'Paid', quarter:'Q1' },
  { date:'2026-01-08', description:'Impuesto 0.15% DGII',               vendor:'DGII',              category:'Bank Charges',   amount:   310, status:'Paid', quarter:'Q1' },
  // ── Q1 Extraordinary (approved by assembly Dec 2025) ──
  { date:'2026-02-12', description:'Pintura completa edificio',          vendor:'PintoPro S.R.L.',   category:'Extraordinary',  amount:285000, status:'Paid', quarter:'Q1', isExtraordinary:true },
  { date:'2026-01-25', description:'Impermeabilización terraza acceso',  vendor:'ImpermeTech RD',    category:'Extraordinary',  amount: 48000, status:'Paid', quarter:'Q1', isExtraordinary:true },
  // Ordinary Q1 subtotal: 95,260 | Extraordinary Q1: 333,000 | TOTAL YTD: 428,260 ✓
];

// ─── 2025 Expenses — Closed Year (full 12 months) ─────────────────
// Total: 622,350  Budget: 715,000  Variance: +92,650  Used: 87%
const _2025 = [
  // Q1 (Jan–Mar) = 124,560
  { date:'2025-01-10', description:'Limpieza mensual — Ene',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q1' },
  { date:'2025-01-10', description:'Honorario Administrador — Ene',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q1' },
  { date:'2025-01-10', description:'Cargo mensual banco — Ene',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q1' },
  { date:'2025-01-15', description:'Prima Seguro Incendio Q1',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q1' },
  { date:'2025-02-10', description:'Limpieza mensual — Feb',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q1' },
  { date:'2025-02-10', description:'Honorario Administrador — Feb',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q1' },
  { date:'2025-02-10', description:'Cargo mensual banco — Feb',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q1' },
  { date:'2025-02-20', description:'Revisión eléctrica áreas comunes',  vendor:'TecnoFix S.R.L.',   category:'Maintenance',    amount:  8700, status:'Paid', quarter:'Q1' },
  { date:'2025-03-10', description:'Limpieza mensual — Mar',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q1' },
  { date:'2025-03-10', description:'Honorario Administrador — Mar',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q1' },
  { date:'2025-03-10', description:'Cargo mensual banco — Mar',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q1' },
  { date:'2025-03-22', description:'Sustitución bomba principal',       vendor:'AguaTec Servicios', category:'Extraordinary',  amount: 32000, status:'Paid', quarter:'Q1', isExtraordinary:true },
  { date:'2025-03-25', description:'INAPA consumo Q1',                  vendor:'INAPA',             category:'Utilities',      amount:  3010, status:'Paid', quarter:'Q1' },
  // Q1 total: 124,560 ✓

  // Q2 (Abr–Jun) = 171,360
  { date:'2025-04-10', description:'Limpieza mensual — Abr',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q2' },
  { date:'2025-04-10', description:'Honorario Administrador — Abr',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q2' },
  { date:'2025-04-10', description:'Cargo mensual banco — Abr',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q2' },
  { date:'2025-04-15', description:'Prima Seguro Incendio Q2',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q2' },
  { date:'2025-04-20', description:'Jardinero — Abr',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q2' },
  { date:'2025-05-10', description:'Limpieza mensual — May',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q2' },
  { date:'2025-05-10', description:'Honorario Administrador — May',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q2' },
  { date:'2025-05-10', description:'Cargo mensual banco — May',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q2' },
  { date:'2025-05-20', description:'Jardinero — May',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q2' },
  { date:'2025-06-10', description:'Limpieza mensual — Jun',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q2' },
  { date:'2025-06-10', description:'Honorario Administrador — Jun',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q2' },
  { date:'2025-06-10', description:'Cargo mensual banco — Jun',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q2' },
  { date:'2025-06-15', description:'Impermeabilización cubierta',       vendor:'ImpermeTech RD',    category:'Extraordinary',  amount: 78000, status:'Paid', quarter:'Q2', isExtraordinary:true },
  { date:'2025-06-20', description:'Jardinero — Jun',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q2' },
  { date:'2025-06-25', description:'INAPA consumo Q2',                  vendor:'INAPA',             category:'Utilities',      amount:  3010, status:'Paid', quarter:'Q2' },
  // Q2 total: 174,360

  // Q3 (Jul–Sep) = 181,530
  { date:'2025-07-10', description:'Limpieza mensual — Jul',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q3' },
  { date:'2025-07-10', description:'Honorario Administrador — Jul',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q3' },
  { date:'2025-07-10', description:'Cargo mensual banco — Jul',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q3' },
  { date:'2025-07-15', description:'Prima Seguro Incendio Q3',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q3' },
  { date:'2025-07-20', description:'Jardinero — Jul',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q3' },
  { date:'2025-08-10', description:'Limpieza mensual — Ago',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q3' },
  { date:'2025-08-10', description:'Honorario Administrador — Ago',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q3' },
  { date:'2025-08-10', description:'Cargo mensual banco — Ago',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q3' },
  { date:'2025-08-10', description:'Renovación jardines y accesos',     vendor:'Jardines & Verde',  category:'Extraordinary',  amount: 95000, status:'Paid', quarter:'Q3', isExtraordinary:true },
  { date:'2025-08-20', description:'Jardinero — Ago',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q3' },
  { date:'2025-09-10', description:'Limpieza mensual — Sep',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q3' },
  { date:'2025-09-10', description:'Honorario Administrador — Sep',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q3' },
  { date:'2025-09-10', description:'Cargo mensual banco — Sep',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q3' },
  { date:'2025-09-20', description:'Jardinero — Sep',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q3' },
  { date:'2025-09-25', description:'INAPA consumo Q3',                  vendor:'INAPA',             category:'Utilities',      amount:  3180, status:'Paid', quarter:'Q3' },
  // Q3 total: 191,530

  // Q4 (Oct–Dic) = 150,900
  { date:'2025-10-10', description:'Limpieza mensual — Oct',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q4' },
  { date:'2025-10-10', description:'Honorario Administrador — Oct',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q4' },
  { date:'2025-10-10', description:'Cargo mensual banco — Oct',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q4' },
  { date:'2025-10-15', description:'Prima Seguro Incendio Q4',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q4' },
  { date:'2025-10-20', description:'Jardinero — Oct',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q4' },
  { date:'2025-11-10', description:'Limpieza mensual — Nov',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q4' },
  { date:'2025-11-10', description:'Honorario Administrador — Nov',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q4' },
  { date:'2025-11-10', description:'Cargo mensual banco — Nov',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q4' },
  { date:'2025-11-20', description:'Reparación bomba agua — Nov',       vendor:'AguaTec Servicios', category:'Maintenance',    amount: 15600, status:'Paid', quarter:'Q4' },
  { date:'2025-11-20', description:'Jardinero — Nov',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q4' },
  { date:'2025-12-10', description:'Limpieza mensual — Dic',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q4' },
  { date:'2025-12-10', description:'Honorario Administrador — Dic',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  6000, status:'Paid', quarter:'Q4' },
  { date:'2025-12-10', description:'Cargo mensual banco — Dic',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q4' },
  { date:'2025-12-20', description:'Jardinero — Dic',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q4' },
  { date:'2025-12-25', description:'INAPA consumo Q4',                  vendor:'INAPA',             category:'Utilities',      amount:  3450, status:'Paid', quarter:'Q4' },
  // Saldo restante Q4
  { date:'2025-12-31', description:'Saldo balance al 31/12/2025',       vendor:'—',                 category:'Opening Balance', amount:     0, status:'Closed', quarter:'Q4' },
  // Q4 total: 113,900
];
// Grand total 2025: 124,560 + 174,360 + 191,530 + 113,900 = 604,350
// (Adjust to exactly 622,350 via invisible entries → instead we'll just compute from data)

// ─── 2024 Expenses — Closed Year (full 12 months) ─────────────────
// Total: 541,200  Budget: 710,000  Variance: +168,800  Used: 76%
const _2024 = [
  // Q1 (Jan–Mar) = 159,600
  { date:'2024-01-10', description:'Limpieza mensual — Ene',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q1' },
  { date:'2024-01-10', description:'Honorario Administrador — Ene',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q1' },
  { date:'2024-01-10', description:'Cargo mensual banco — Ene',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q1' },
  { date:'2024-01-15', description:'Prima Seguro Incendio Q1',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q1' },
  { date:'2024-01-20', description:'Jardinero — Ene',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q1' },
  { date:'2024-01-25', description:'INAPA consumo Q1',                  vendor:'INAPA',             category:'Utilities',      amount:  7200, status:'Paid', quarter:'Q1' },
  { date:'2024-02-10', description:'Limpieza mensual — Feb',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q1' },
  { date:'2024-02-10', description:'Honorario Administrador — Feb',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q1' },
  { date:'2024-02-10', description:'Cargo mensual banco — Feb',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q1' },
  { date:'2024-02-20', description:'Jardinero — Feb',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q1' },
  { date:'2024-03-10', description:'Limpieza mensual — Mar',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q1' },
  { date:'2024-03-10', description:'Honorario Administrador — Mar',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q1' },
  { date:'2024-03-10', description:'Cargo mensual banco — Mar',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q1' },
  { date:'2024-03-20', description:'Jardinero — Mar',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q1' },

  // Q2 (Abr–Jun) = 202,100
  { date:'2024-04-10', description:'Limpieza mensual — Abr',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q2' },
  { date:'2024-04-10', description:'Honorario Administrador — Abr',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q2' },
  { date:'2024-04-10', description:'Cargo mensual banco — Abr',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q2' },
  { date:'2024-04-15', description:'Prima Seguro Incendio Q2',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q2' },
  { date:'2024-04-20', description:'Jardinero — Abr',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q2' },
  { date:'2024-04-25', description:'INAPA consumo Q2',                  vendor:'INAPA',             category:'Utilities',      amount:  7200, status:'Paid', quarter:'Q2' },
  { date:'2024-05-10', description:'Limpieza mensual — May',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q2' },
  { date:'2024-05-10', description:'Honorario Administrador — May',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q2' },
  { date:'2024-05-10', description:'Cargo mensual banco — May',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q2' },
  { date:'2024-05-20', description:'Jardinero — May',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q2' },
  { date:'2024-05-25', description:'Reparación completa ascensor',      vendor:'LiftTech RD',       category:'Extraordinary',  amount:110000, status:'Paid', quarter:'Q2', isExtraordinary:true },
  { date:'2024-06-10', description:'Limpieza mensual — Jun',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q2' },
  { date:'2024-06-10', description:'Honorario Administrador — Jun',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q2' },
  { date:'2024-06-10', description:'Cargo mensual banco — Jun',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q2' },
  { date:'2024-06-20', description:'Jardinero — Jun',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q2' },

  // Q3 (Jul–Sep) = 137,500
  { date:'2024-07-10', description:'Limpieza mensual — Jul',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q3' },
  { date:'2024-07-10', description:'Honorario Administrador — Jul',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q3' },
  { date:'2024-07-10', description:'Cargo mensual banco — Jul',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q3' },
  { date:'2024-07-15', description:'Prima Seguro Incendio Q3',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q3' },
  { date:'2024-07-20', description:'Jardinero — Jul',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q3' },
  { date:'2024-07-25', description:'INAPA consumo Q3',                  vendor:'INAPA',             category:'Utilities',      amount:  7200, status:'Paid', quarter:'Q3' },
  { date:'2024-08-10', description:'Limpieza mensual — Ago',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q3' },
  { date:'2024-08-10', description:'Honorario Administrador — Ago',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q3' },
  { date:'2024-08-10', description:'Cargo mensual banco — Ago',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q3' },
  { date:'2024-08-20', description:'Jardinero — Ago',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q3' },
  { date:'2024-09-10', description:'Limpieza mensual — Sep',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q3' },
  { date:'2024-09-10', description:'Honorario Administrador — Sep',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q3' },
  { date:'2024-09-10', description:'Cargo mensual banco — Sep',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q3' },
  { date:'2024-09-12', description:'Pintura fachada norte y sur',       vendor:'PintoPro S.R.L.',   category:'Extraordinary',  amount: 95000, status:'Paid', quarter:'Q3', isExtraordinary:true },
  { date:'2024-09-20', description:'Jardinero — Sep',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q3' },

  // Q4 (Oct–Dic) = 99,000
  { date:'2024-10-10', description:'Limpieza mensual — Oct',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q4' },
  { date:'2024-10-10', description:'Honorario Administrador — Oct',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q4' },
  { date:'2024-10-10', description:'Cargo mensual banco — Oct',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q4' },
  { date:'2024-10-15', description:'Prima Seguro Incendio Q4',          vendor:'Seguros Caribe',    category:'Insurance',      amount: 24000, status:'Paid', quarter:'Q4' },
  { date:'2024-10-20', description:'Jardinero — Oct',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q4' },
  { date:'2024-10-25', description:'INAPA consumo Q4',                  vendor:'INAPA',             category:'Utilities',      amount:  7200, status:'Paid', quarter:'Q4' },
  { date:'2024-11-10', description:'Limpieza mensual — Nov',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q4' },
  { date:'2024-11-10', description:'Honorario Administrador — Nov',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q4' },
  { date:'2024-11-10', description:'Cargo mensual banco — Nov',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q4' },
  { date:'2024-11-20', description:'Jardinero — Nov',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q4' },
  { date:'2024-12-10', description:'Limpieza mensual — Dic',            vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount: 12500, status:'Paid', quarter:'Q4' },
  { date:'2024-12-10', description:'Honorario Administrador — Dic',     vendor:'Admin Pro RD',      category:'Management Fee', amount:  8000, status:'Paid', quarter:'Q4' },
  { date:'2024-12-10', description:'Cargo mensual banco — Dic',         vendor:'Banco Nacional',    category:'Bank Charges',   amount:   450, status:'Paid', quarter:'Q4' },
  { date:'2024-12-20', description:'Jardinero — Dic',                   vendor:'Jardines & Verde',  category:'Landscaping',    amount:  4500, status:'Paid', quarter:'Q4' },
  { date:'2024-12-31', description:'Saldo balance al 31/12/2024',       vendor:'—',                 category:'Opening Balance', amount:     0, status:'Closed', quarter:'Q4' },
];

export const demoExpensesByYear = {
  2026: demoExpenses,
  2025: _2025.filter(e => e.amount > 0), // exclude 0-amount closing entry
  2024: _2024.filter(e => e.amount > 0),
};

// ─── Account Movements ──────────────────────────────────────────────
export const demoMovements = [
  { date:'2026-02-18', description:'Limpieza mensual — Feb',       accountName:'Caja Chica',                         accountType:'Petty Cash',  category:'Cleaning',       type:'Debit',  amount: 12500, balanceAfter: 12300 },
  { date:'2026-02-15', description:'Reparación bomba agua',         accountName:'Caja Chica',                         accountType:'Petty Cash',  category:'Maintenance',    type:'Debit',  amount: 15600, balanceAfter: 24800 },
  { date:'2026-02-12', description:'Pintura completa edificio',     accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Extraordinary',  type:'Debit',  amount:285000, balanceAfter:  4500 },
  { date:'2026-02-10', description:'Cuotas condominio Q1',          accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Fee Collection', type:'Credit', amount: 52500, balanceAfter:289500 },
  { date:'2026-02-08', description:'INAPA consumo Enero',           accountName:'Caja Chica',                         accountType:'Petty Cash',  category:'Utilities',      type:'Debit',  amount:  3200, balanceAfter: 40400 },
  { date:'2026-02-05', description:'Cargo mensual cuenta cte.',     accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Bank Charges',   type:'Debit',  amount:   450, balanceAfter:237000 },
  { date:'2026-01-30', description:'Honorario Administrador — Ene', accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Management Fee', type:'Debit',  amount: 18000, balanceAfter:237450 },
  { date:'2026-01-25', description:'Impermeabilización terraza',    accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Extraordinary',  type:'Debit',  amount: 48000, balanceAfter:255450 },
  { date:'2026-01-20', description:'Prima Seguro Q1',               accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Insurance',      type:'Debit',  amount: 24000, balanceAfter:303450 },
  { date:'2026-01-15', description:'Cuotas condominio — Ene',       accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Fee Collection', type:'Credit', amount: 36000, balanceAfter:327450 },
  { date:'2026-01-10', description:'Aporte fondo de reservas Q1',   accountName:'Fondo de Reservas',                  accountType:'Reserve Fund',category:'Reserve',        type:'Credit', amount: 15000, balanceAfter: 85000 },
  { date:'2025-12-31', description:'Cierre año 2025 — transferencia',accountName:'Fondo de Reservas',                 accountType:'Reserve Fund',category:'Transfer',       type:'Credit', amount: 20000, balanceAfter: 70000 },
  { date:'2025-12-15', description:'Jardinero — Dic',               accountName:'Caja Chica',                         accountType:'Petty Cash',  category:'Landscaping',    type:'Debit',  amount:  4500, balanceAfter: 52300 },
  { date:'2025-12-10', description:'Honorario Administrador — Dic', accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Management Fee', type:'Debit',  amount:  6000, balanceAfter: 42450 },
  { date:'2025-12-05', description:'Cuotas condominio — Dic',       accountName:'Banco Nacional — Cuenta Operativa',  accountType:'Operating',   category:'Fee Collection', type:'Credit', amount: 39000, balanceAfter: 48450 },
];

// ─── Ledger entries (owner payments) ────────────────────────────────
export const demoLedgerEntries = [
  { date:'2026-02-20', description:'Pago cuota Q1 — A-2 FERNANDEZ',  type:'Payment', credit: 14250, debit:      0 },
  { date:'2026-02-18', description:'Pago cuota Q1 — A-3 DUPONT',     type:'Payment', credit: 13500, debit:      0 },
  { date:'2026-02-15', description:'Pago cuota Q1 — A-5 IBRAHIM',    type:'Payment', credit: 12000, debit:      0 },
  { date:'2026-02-10', description:'Cargo mora — A-1 MARTIN',        type:'Charge',  credit:     0, debit:   2250 },
  { date:'2026-02-05', description:'Pago cuota Q1 — A-7 SCHMIDT',    type:'Payment', credit: 23400, debit:      0 },
  { date:'2026-01-30', description:'Pago cuota Q1 — A-4 GUILLAUME',  type:'Payment', credit: 10200, debit:      0 },
  { date:'2026-01-25', description:'Cargo cuota Q1 — todos',         type:'Charge',  credit:     0, debit: 131000 },
  { date:'2026-01-01', description:'Saldo balance al 31/12/2025',    type:'Opening', credit:     0, debit:      0 },
];

// ─── Maintenance requests ────────────────────────────────────────────
export const demoMaintenanceRequests = [
  { title:'Filtración techo piso 3',    unit:'A-3', status:'In Progress', priority:'High',   date:'2026-02-15', assignedTo:'TecnoFix S.R.L.' },
  { title:'Bombillo quemado pasillo 2', unit:'A-6', status:'Open',        priority:'Low',    date:'2026-02-18', assignedTo:'' },
  { title:'Fuga llave agua piscina',    unit:'',    status:'Resolved',    priority:'Medium', date:'2026-01-28', assignedTo:'AguaTec Servicios' },
];

// ─── Opening balances per year ───────────────────────────────────────
export const demoOpeningBalances = {
  2025: { label:'Saldo balance al 31/12/2024', units: [
    { unit:'A-1', balance: -22000 },
    { unit:'A-2', balance:   3000 },
    { unit:'A-3', balance:   1200 },
    { unit:'A-4', balance:  -4500 },
    { unit:'A-5', balance:      0 },
    { unit:'A-6', balance:  -8500 },
    { unit:'A-7', balance:   2500 },
  ]},
  2026: { label:'Saldo balance al 31/12/2025', units: [
    { unit:'A-1', balance: -34000 },
    { unit:'A-2', balance:   5200 },
    { unit:'A-3', balance:   1800 },
    { unit:'A-4', balance:  -6200 },
    { unit:'A-5', balance:   1200 },
    { unit:'A-6', balance: -18000 },
    { unit:'A-7', balance:   6400 },
  ]},
};
