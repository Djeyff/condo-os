/**
 * Demo data for Condo Manager OS public demo
 * Activated when DEMO_MODE=true (Vercel env var)
 * All names, amounts and details are entirely fictional.
 */

export const DEMO_MODE = process.env.DEMO_MODE === 'true';

export const demoBranding = {
  name: 'Coral Breeze Residences',
  logo: null,
  primaryColor: '#2563eb',
  accentColor: '#d4a853',
  currency: 'DOP',
};

export const demoUnits = [
  { unit: 'A-1', owner: 'Sophie MARTIN / Bruno MARTIN',   balance: -45200, share: 15.5, status: 'Overdue 90+' },
  { unit: 'A-2', owner: 'Carlos FERNANDEZ',               balance:   3750, share: 13.2, status: 'Current' },
  { unit: 'A-3', owner: 'Hélène DUPONT',                  balance:      0, share: 12.9, status: 'Current' },
  { unit: 'A-4', owner: 'Patrick GUILLAUME',              balance:  -8200, share:  9.7, status: 'Overdue 60' },
  { unit: 'A-5', owner: 'Nadia & Karim IBRAHIM',          balance:   1500, share: 11.3, status: 'Current' },
  { unit: 'A-6', owner: 'Thierry ROUSSEAU',               balance: -22400, share: 15.1, status: 'Overdue 30' },
  { unit: 'A-7', owner: 'Laura SCHMIDT',                  balance:   6800, share: 22.3, status: 'Current' },
];

export const demoCashAccounts = [
  { id: 'demo-reserve',   name: 'Fondo de Reservas',       balance:  85000, type: 'Reserve Fund' },
  { id: 'demo-petty',     name: 'Caja Chica',              balance:  12300, type: 'Petty Cash' },
  { id: 'demo-operating', name: 'Banco Nacional — Cuenta Operativa', balance: 47500, type: 'Operating' },
];

export const demoBudgetItems = [
  { category: 'Limpieza y Aseo',             annualBudget: 180000, actual: 148500, fiscalYear: 2026 },
  { category: 'Mantenimiento General',        annualBudget: 120000, actual:  74800, fiscalYear: 2026 },
  { category: 'Seguro Incendio y R.C.',        annualBudget:  96000, actual:  48000, fiscalYear: 2026 },
  { category: 'INAPA / Agua',                  annualBudget:  48000, actual:  19200, fiscalYear: 2026 },
  { category: 'Honorario Administrador',       annualBudget:  72000, actual:  54000, fiscalYear: 2026 },
  { category: 'Gastos Bancarios',              annualBudget:   8000, actual:   2940, fiscalYear: 2026 },
];

export const demoExpenses = [
  { date:'2026-02-18', description:'Limpieza mensual - Feb',          vendor:'LimpiMax S.R.L.',    category:'Cleaning',         amount:12500, status:'Paid',    quarter:'Q1' },
  { date:'2026-02-15', description:'Reparación bomba de agua',        vendor:'AguaTec Servicios',  category:'Maintenance',      amount:15600, status:'Paid',    quarter:'Q1' },
  { date:'2026-02-10', description:'Cargo mensual cuenta corriente',  vendor:'Banco Nacional',     category:'Bank Charges',     amount:   450, status:'Paid',   quarter:'Q1' },
  { date:'2026-02-05', description:'INAPA consumo Enero',             vendor:'INAPA',              category:'Utilities',        amount: 3200, status:'Paid',    quarter:'Q1' },
  { date:'2026-01-28', description:'Limpieza mensual - Ene',          vendor:'LimpiMax S.R.L.',    category:'Cleaning',         amount:12500, status:'Paid',    quarter:'Q1' },
  { date:'2026-01-20', description:'Revisión eléctrica áreas comunes',vendor:'TecnoFix S.R.L.',   category:'Maintenance',      amount: 8700, status:'Paid',    quarter:'Q1' },
  { date:'2026-01-15', description:'Prima Seguro Incendio Q1',        vendor:'Seguros Caribe',     category:'Insurance',        amount:24000, status:'Paid',    quarter:'Q1' },
  { date:'2026-01-10', description:'Honorario Administrador - Ene',   vendor:'Admin Pro RD',       category:'Management Fee',   amount:18000, status:'Paid',    quarter:'Q1' },
  { date:'2026-01-08', description:'Impuesto 0.15% DGII',             vendor:'DGII',               category:'Bank Charges',     amount:  310, status:'Paid',    quarter:'Q1' },
  { date:'2025-12-20', description:'Limpieza mensual - Dic',          vendor:'LimpiMax S.R.L.',    category:'Cleaning',         amount:12500, status:'Paid',    quarter:'Q4' },
  { date:'2025-12-15', description:'Jardinero - corte mensual',       vendor:'Jardines & Verde',   category:'Landscaping',      amount: 4500, status:'Paid',    quarter:'Q4' },
  { date:'2025-12-10', description:'Honorario Administrador - Dic',   vendor:'Admin Pro RD',       category:'Management Fee',   amount:18000, status:'Paid',    quarter:'Q4' },
  { date:'2025-12-05', description:'Pintura fachada este',            vendor:'PintoPro S.R.L.',    category:'Maintenance',      amount:32000, status:'Paid',    quarter:'Q4', isExtraordinary: true },
  { date:'2025-11-25', description:'INAPA consumo Oct',               vendor:'INAPA',              category:'Utilities',        amount: 2900, status:'Paid',    quarter:'Q4' },
  { date:'2025-11-20', description:'Limpieza mensual - Nov',          vendor:'LimpiMax S.R.L.',    category:'Cleaning',         amount:12500, status:'Paid',    quarter:'Q4' },
];

export const demoMovements = [
  // Petty Cash
  { date:'2026-02-18', description:'Limpieza mensual - Feb',      accountName:'Caja Chica',              accountType:'Petty Cash',  category:'Cleaning',       type:'Debit',  amount:12500, balanceAfter:12300 },
  { date:'2026-02-15', description:'Reparación bomba agua',       accountName:'Caja Chica',              accountType:'Petty Cash',  category:'Maintenance',    type:'Debit',  amount:15600, balanceAfter:24800 },
  { date:'2026-02-10', description:'Cuotas condominio Ene-Feb',   accountName:'Banco Nacional — Cuenta Operativa', accountType:'Operating', category:'Fee Collection', type:'Credit', amount:43500, balanceAfter:47500 },
  { date:'2026-02-08', description:'INAPA consumo Enero',         accountName:'Caja Chica',              accountType:'Petty Cash',  category:'Utilities',      type:'Debit',  amount: 3200, balanceAfter:40400 },
  { date:'2026-02-05', description:'Cargo mensual TD Clásica',    accountName:'Banco Nacional — Cuenta Operativa', accountType:'Operating', category:'Bank Charges',  type:'Debit',  amount:  450, balanceAfter: 4000 },
  { date:'2026-01-30', description:'Honorario Administrador',     accountName:'Banco Nacional — Cuenta Operativa', accountType:'Operating', category:'Management Fee',type:'Debit',  amount:18000, balanceAfter: 4450 },
  { date:'2026-01-25', description:'Prima Seguro Q1',             accountName:'Banco Nacional — Cuenta Operativa', accountType:'Operating', category:'Insurance',     type:'Debit',  amount:24000, balanceAfter:22450 },
  { date:'2026-01-20', description:'Cuotas condominio Ene',       accountName:'Banco Nacional — Cuenta Operativa', accountType:'Operating', category:'Fee Collection', type:'Credit', amount:36000, balanceAfter:46450 },
  { date:'2026-01-15', description:'TecnoFix revisión eléctrica', accountName:'Caja Chica',              accountType:'Petty Cash',  category:'Maintenance',    type:'Debit',  amount: 8700, balanceAfter:43600 },
  { date:'2026-01-10', description:'Aporte fondo de reservas',    accountName:'Fondo de Reservas',       accountType:'Reserve Fund',category:'Reserve',        type:'Credit', amount:15000, balanceAfter:85000 },
  { date:'2025-12-31', description:'Cierre anual - transferencia',accountName:'Fondo de Reservas',       accountType:'Reserve Fund',category:'Transfer',       type:'Credit', amount:20000, balanceAfter:70000 },
  { date:'2025-12-20', description:'Jardinero Dic',               accountName:'Caja Chica',              accountType:'Petty Cash',  category:'Landscaping',    type:'Debit',  amount: 4500, balanceAfter:52300 },
  { date:'2025-12-15', description:'Pintura fachada este',        accountName:'Banco Nacional — Cuenta Operativa', accountType:'Operating', category:'Maintenance',    type:'Debit',  amount:32000, balanceAfter:10450 },
  { date:'2025-12-10', description:'Honorario Administrador Dic', accountName:'Banco Nacional — Cuenta Operativa', accountType:'Operating', category:'Management Fee',type:'Debit',  amount:18000, balanceAfter:42450 },
  { date:'2025-12-05', description:'Cuotas condominio Dic',       accountName:'Banco Nacional — Cuenta Operativa', accountType:'Operating', category:'Fee Collection', type:'Credit', amount:39000, balanceAfter:60450 },
];

export const demoMaintenanceRequests = [
  { title:'Filtración techo piso 3',   unit:'A-3', status:'In Progress', priority:'High',   date:'2026-02-15', assignedTo:'TecnoFix S.R.L.' },
  { title:'Bombillo quemado pasillo 2', unit:'A-6', status:'Open',       priority:'Low',    date:'2026-02-18', assignedTo:'' },
  { title:'Fuga llave agua piscina',    unit:'',    status:'Resolved',   priority:'Medium', date:'2026-01-28', assignedTo:'AguaTec Servicios' },
];

// Opening balances per year (key = YYYY)
export const demoOpeningBalances = {
  2025: [
    { unit: 'A-1', balance: -12000 },
    { unit: 'A-2', balance:   3000 },
    { unit: 'A-3', balance:   1500 },
    { unit: 'A-4', balance:  -4500 },
    { unit: 'A-5', balance:      0 },
    { unit: 'A-6', balance:  -8000 },
    { unit: 'A-7', balance:   2500 },
  ],
  2026: [
    // from demoUnits above
  ],
};

// Per-year budget totals (for archive)
export const demoBudgetByYear = {
  2024: 480000,
  2025: 510000,
  2026: 524000,
};

// Demo ledger entries (recent owner payments)
export const demoLedgerEntries = [
  { date:'2026-02-20', description:'Pago cuota Q1 - A-2 FERNANDEZ',  type:'Payment', credit:14250, debit:0 },
  { date:'2026-02-18', description:'Pago cuota Q1 - A-3 DUPONT',     type:'Payment', credit:13500, debit:0 },
  { date:'2026-02-15', description:'Pago cuota Q1 - A-5 IBRAHIM',    type:'Payment', credit:12000, debit:0 },
  { date:'2026-02-10', description:'Cargo mora - A-1 MARTIN',         type:'Charge',  credit:0, debit:2250 },
  { date:'2026-02-05', description:'Pago cuota Q1 - A-7 SCHMIDT',     type:'Payment', credit:23400, debit:0 },
  { date:'2026-01-30', description:'Pago cuota Q1 - A-4 GUILLAUME',   type:'Payment', credit:10200, debit:0 },
  { date:'2026-01-25', description:'Cargo cuota Q1 todos los aptos',  type:'Charge',  credit:0, debit:131000 },
  { date:'2026-01-20', description:'Saldo balance al 31/12/2025',     type:'Opening', credit:0, debit:0 },
];

// Demo expenses by year (2025 summary for archive)
export const demoExpensesByYear = {
  2025: [
    { date:'2025-12-20', description:'Limpieza mensual - Dic',         vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount:12500, status:'Paid', quarter:'Q4' },
    { date:'2025-12-15', description:'Jardinero - corte dic',          vendor:'Jardines & Verde',  category:'Landscaping',    amount: 4500, status:'Paid', quarter:'Q4' },
    { date:'2025-12-10', description:'Honorario Administrador - Dic',  vendor:'Admin Pro RD',      category:'Management Fee', amount:18000, status:'Paid', quarter:'Q4' },
    { date:'2025-11-28', description:'Reparación bomba agua',          vendor:'AguaTec Servicios', category:'Maintenance',    amount:15600, status:'Paid', quarter:'Q4' },
    { date:'2025-11-20', description:'Limpieza mensual - Nov',         vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount:12500, status:'Paid', quarter:'Q4' },
    { date:'2025-11-05', description:'Cargo mensual banco',            vendor:'Banco Nacional',    category:'Bank Charges',   amount:  450, status:'Paid', quarter:'Q4' },
    { date:'2025-10-20', description:'Limpieza mensual - Oct',         vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount:12500, status:'Paid', quarter:'Q4' },
    { date:'2025-10-01', description:'Prima Seguro Q4',                vendor:'Seguros Caribe',    category:'Insurance',      amount:24000, status:'Paid', quarter:'Q4' },
    { date:'2025-09-20', description:'Limpieza mensual - Sep',         vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount:12500, status:'Paid', quarter:'Q3' },
    { date:'2025-09-15', description:'Revisión eléctrica',             vendor:'TecnoFix S.R.L.',   category:'Maintenance',    amount: 8700, status:'Paid', quarter:'Q3' },
    { date:'2025-09-01', description:'Honorario Admin Q3',             vendor:'Admin Pro RD',      category:'Management Fee', amount:54000, status:'Paid', quarter:'Q3' },
    { date:'2025-07-01', description:'Prima Seguro Q3',                vendor:'Seguros Caribe',    category:'Insurance',      amount:24000, status:'Paid', quarter:'Q3' },
    { date:'2025-06-20', description:'Pintura fachada principal',      vendor:'PintoPro S.R.L.',   category:'Maintenance',    amount:48000, status:'Paid', quarter:'Q2', isExtraordinary:true },
    { date:'2025-06-01', description:'INAPA H1',                       vendor:'INAPA',             category:'Utilities',      amount:12600, status:'Paid', quarter:'Q2' },
    { date:'2025-04-01', description:'Prima Seguro Q2',                vendor:'Seguros Caribe',    category:'Insurance',      amount:24000, status:'Paid', quarter:'Q2' },
    { date:'2025-01-01', description:'Prima Seguro Q1',                vendor:'Seguros Caribe',    category:'Insurance',      amount:24000, status:'Paid', quarter:'Q1' },
    { date:'2025-01-05', description:'Honorario Admin Q1',             vendor:'Admin Pro RD',      category:'Management Fee', amount:54000, status:'Paid', quarter:'Q1' },
    { date:'2025-01-10', description:'Limpieza mensual - Ene',         vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount:12500, status:'Paid', quarter:'Q1' },
  ],
  2024: [
    { date:'2024-12-15', description:'Cierre anual - varios servicios',vendor:'Varios',            category:'Maintenance',    amount:32000, status:'Paid', quarter:'Q4' },
    { date:'2024-10-01', description:'Prima Seguro H2',                vendor:'Seguros Caribe',    category:'Insurance',      amount:48000, status:'Paid', quarter:'Q4' },
    { date:'2024-09-05', description:'Honorario Admin H2',             vendor:'Admin Pro RD',      category:'Management Fee', amount:54000, status:'Paid', quarter:'Q3' },
    { date:'2024-06-01', description:'Prima Seguro H1',                vendor:'Seguros Caribe',    category:'Insurance',      amount:48000, status:'Paid', quarter:'Q2' },
    { date:'2024-05-20', description:'Reparación ascensor',            vendor:'LiftTech RD',       category:'Maintenance',    amount:68000, status:'Paid', quarter:'Q2', isExtraordinary:true },
    { date:'2024-04-01', description:'Honorario Admin H1',             vendor:'Admin Pro RD',      category:'Management Fee', amount:54000, status:'Paid', quarter:'Q1' },
    { date:'2024-01-15', description:'Limpieza anual contrato',        vendor:'LimpiMax S.R.L.',   category:'Cleaning',       amount:96000, status:'Paid', quarter:'Q1' },
    { date:'2024-01-05', description:'INAPA 2024',                     vendor:'INAPA',             category:'Utilities',      amount:28800, status:'Paid', quarter:'Q1' },
  ],
};
