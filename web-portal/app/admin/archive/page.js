import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getNumber, getSelect, getDate, getText } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import { DEMO_MODE, demoBranding, demoExpensesByYear, demoExpenses, demoBudgetByYear, demoBudgetItemsByYear, demoOpeningBalances } from '@/lib/demoData';

const CURRENT_YEAR = new Date().getFullYear();

export default async function ArchivePage({ searchParams }) {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');

  const branding = DEMO_MODE ? demoBranding : getBranding();
  const selectedYear = searchParams?.year ? parseInt(searchParams.year) : CURRENT_YEAR - 1;

  const fmt = (n) => {
    const abs = Math.abs(n || 0);
    const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + str;
  };

  // Years list — current year always shown as "Live" link, rest are archive
  const archiveYears = DEMO_MODE
    ? [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
    : [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

  // ---- Load expenses for selected year ----
  let expenses = [];
  if (DEMO_MODE) {
    if (selectedYear === CURRENT_YEAR) {
      expenses = demoExpenses;
    } else {
      expenses = demoExpensesByYear[selectedYear] || [];
    }
  } else {
    const expDB = getDB('expenses');
    try {
      if (expDB) {
        const pages = await queryDB(expDB, undefined, [{ property: 'Date', direction: 'descending' }]);
        expenses = pages
          .map(p => ({
            date: getDate(p, 'Date'),
            description: getTitle(p),
            vendor: getText(p, 'Vendor'),
            category: getSelect(p, 'Category') || 'Uncategorized',
            amount: getNumber(p, 'Amount') || 0,
            status: getSelect(p, 'Status') || '',
            quarter: getSelect(p, 'Quarter') || '',
            isExtraordinary: p.properties?.['Is Extraordinary']?.checkbox || false,
            fiscalYear: getNumber(p, 'Fiscal Year') || 0,
          }))
          .filter(e => e.date?.startsWith(String(selectedYear)) || e.fiscalYear === selectedYear);
      }
    } catch(e) { console.error('Expenses fetch error:', e.message); }
  }

  // ---- Load budget for selected year ----
  let annualBudget = 0;
  let budgetByCategory = {};
  if (DEMO_MODE) {
    const yearItems = demoBudgetItemsByYear[selectedYear] || [];
    yearItems.forEach(b => {
      budgetByCategory[b.category] = b.annualBudget;
      annualBudget += b.annualBudget;
    });
  } else {
    const budgetDB = getDB('budget');
    try {
      if (budgetDB) {
        const pages = await queryDB(budgetDB);
        pages
          .filter(p => {
            const yr = getNumber(p, 'Fiscal Year') || getNumber(p, 'Year');
            return yr === selectedYear || !yr;
          })
          .forEach(p => {
            const cat = getTitle(p);
            const amt = getNumber(p, 'Annual Budget') || getNumber(p, 'Budgeted Amount') || 0;
            budgetByCategory[cat] = amt;
            annualBudget += amt;
          });
      }
    } catch(e) { console.error('Budget fetch error:', e.message); }
  }

  // ---- Category aggregation ----
  const catSummary = {};
  expenses.forEach(e => {
    if (!catSummary[e.category]) catSummary[e.category] = { total: 0, count: 0 };
    catSummary[e.category].total += e.amount;
    catSummary[e.category].count++;
  });
  const catSorted = Object.entries(catSummary).sort((a, b) => b[1].total - a[1].total);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const variance = annualBudget - totalSpent;

  // Quarter grouping
  const byQuarter = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  expenses.forEach(e => {
    const q = e.quarter || (e.date ? `Q${Math.ceil(parseInt(e.date.slice(5, 7)) / 3)}` : '');
    if (byQuarter[q] !== undefined) byQuarter[q] += e.amount;
  });

  // Opening balance + year status
  const isRunningYear = selectedYear === CURRENT_YEAR;
  const openingLabel = DEMO_MODE && demoOpeningBalances[selectedYear]
    ? demoOpeningBalances[selectedYear].label
    : `Saldo balance al 31/12/${selectedYear - 1}`;
  const yearStatus = isRunningYear ? `Running Year ${selectedYear} — YTD through ${new Date().toLocaleString('en-US',{month:'long'})} ${new Date().getFullYear()}` : `Closed ${selectedYear} · ${openingLabel}`;

  const GOLD = '#d4a853';
  const catColors = {
    'Cleaning': '#6ee7b7', 'Utilities': '#60a5fa', 'Maintenance': '#fbbf24',
    'Management Fee': '#a78bfa', 'Bank Charges': '#94a3b8', 'Security': '#fb923c',
    'Insurance': '#34d399', 'Landscaping': '#4ade80', 'Uncategorized': '#64748b',
  };
  const getCatColor = (c) => catColors[c] || '#94a3b8';

  return (
    <div className="min-h-screen" style={{ background: '#0a1628', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Header session={session} branding={branding} />
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Header + year tabs */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="mb-1"><a href="/admin" className="text-sm" style={{ color: GOLD }}>← Dashboard</a></div>
            <h2 className="text-2xl font-bold text-white">📅 Annual Accounting</h2>
            <p className="text-sm mt-1" style={{ color: isRunningYear ? '#d4a853' : '#64748b' }}>{yearStatus}</p>
          </div>
          <div className="flex items-center gap-2">
            {archiveYears.map(y => (
              <a key={y} href={`/admin/archive?year=${y}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={y === selectedYear
                  ? { background: GOLD, color: '#0a1628' }
                  : { background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                {y}{y === CURRENT_YEAR ? ' · YTD' : ' · Closed'}
              </a>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl p-4" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Total Spent</p>
            <p className="text-2xl font-bold text-red-400 font-mono mt-1">{fmt(totalSpent)}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>{expenses.length} entries</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Annual Budget</p>
            <p className="text-2xl font-bold font-mono mt-1" style={{ color: GOLD }}>{fmt(annualBudget)}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>Approved</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: `rgba(${variance >= 0 ? '110,231,183' : '248,113,113'},0.06)`, border: `1px solid rgba(${variance >= 0 ? '110,231,183' : '248,113,113'},0.2)` }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Variance</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{variance >= 0 ? '+' : ''}{fmt(variance)}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>{variance >= 0 ? 'Under budget' : 'Over budget'}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Budget Used</p>
            <p className="text-2xl font-bold text-white font-mono mt-1">{annualBudget > 0 ? Math.round(totalSpent / annualBudget * 100) : 0}%</p>
            <div className="mt-2 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className={`h-1.5 rounded-full ${totalSpent / annualBudget > 1 ? 'bg-red-400' : totalSpent / annualBudget > 0.8 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(annualBudget > 0 ? totalSpent / annualBudget * 100 : 0, 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Quarterly breakdown */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {['Q1','Q2','Q3','Q4'].map(q => (
            <div key={q} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-semibold uppercase" style={{ color: GOLD }}>{q}</p>
              <p className="text-lg font-bold font-mono text-white mt-1">{fmt(byQuarter[q])}</p>
            </div>
          ))}
        </div>

        {/* Budget vs Actual by category */}
        <div className="rounded-xl p-5 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-sm font-semibold text-white mb-4">Budget vs. Actual by Category</p>
          <div className="space-y-3">
            {catSorted.map(([cat, data], i) => {
              const budget = budgetByCategory[cat] || 0;
              const pct = budget > 0 ? Math.min((data.total / budget) * 100, 120) : 100;
              const over = budget > 0 && data.total > budget;
              return (
                <div key={i} className="grid grid-cols-12 items-center gap-3">
                  <div className="col-span-3 text-xs font-medium" style={{ color: getCatColor(cat) }}>{cat}</div>
                  <div className="col-span-6">
                    <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className={`h-2 rounded-full ${over ? 'bg-red-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(pct, 100)}%`, background: over ? '#f87171' : getCatColor(cat) }}></div>
                    </div>
                  </div>
                  <div className="col-span-2 text-right font-mono text-xs text-white">{fmt(data.total)}</div>
                  <div className="col-span-1 text-right text-xs" style={{ color: over ? '#f87171' : '#64748b' }}>
                    {budget > 0 ? `${Math.round(pct)}%` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expense table */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold text-white">All Expenses — {selectedYear}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Date', 'Description', 'Vendor', 'Category', 'Q', 'Amount'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{e.date}</td>
                    <td className="px-4 py-3 text-white">
                      {e.description}
                      {e.isExtraordinary && <span className="ml-1 text-yellow-400 text-xs">★ Extraordinary</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{e.vendor || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs" style={{ color: getCatColor(e.category), background: 'rgba(255,255,255,0.04)' }}>{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{e.quarter || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-white font-semibold">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(212,168,83,0.05)', borderTop: '1px solid rgba(212,168,83,0.15)' }}>
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-right" style={{ color: '#94a3b8' }}>TOTAL {selectedYear}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-red-400">{fmt(totalSpent)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
