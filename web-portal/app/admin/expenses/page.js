import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getNumber, getSelect, getDate, getText } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import { DEMO_MODE, demoBranding, demoExpenses, demoExpensesByYear, demoBudgetItems, demoBudgetMap } from '@/lib/demoData';

export default async function ExpensesPage({ searchParams }) {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');

  const branding = DEMO_MODE ? demoBranding : getBranding();
  const selectedCat = searchParams?.category || null;
  const selectedYear = searchParams?.year ? parseInt(searchParams.year) : new Date().getFullYear();

  const fmt = (n) => {
    const abs = Math.abs(n || 0);
    return abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // All years with data (for year tabs)
  const availableYears = DEMO_MODE
    ? [2026, 2025, 2024]
    : null; // set dynamically below

  let allExpenses;
  if (DEMO_MODE) {
    const yearData = demoExpensesByYear[selectedYear] || demoExpenses.filter(e => e.date?.startsWith(String(selectedYear)));
    allExpenses = selectedYear === new Date().getFullYear() ? demoExpenses : (yearData || []);
  } else {
    const expDB = getDB('expenses');
    let expPages = [];
    try { if (expDB) expPages = await queryDB(expDB, undefined, [{ property: 'Date', direction: 'descending' }]); } catch(e) {}
    allExpenses = expPages.map(p => ({
      date: getDate(p, 'Date'),
      description: getTitle(p),
      vendor: getText(p, 'Vendor'),
      category: getSelect(p, 'Category') || 'Uncategorized',
      amount: getNumber(p, 'Amount') || 0,
      status: getSelect(p, 'Status') || '',
      paymentMethod: getSelect(p, 'Payment Method') || '',
      invoiceNum: getText(p, 'Invoice Number'),
      fiscalYear: getNumber(p, 'Fiscal Year') || 0,
      quarter: getSelect(p, 'Quarter') || '',
      isExtraordinary: p.properties?.['Is Extraordinary']?.checkbox || false,
    }));
  }

  // Available years (from data)
  const years = availableYears || [...new Set(allExpenses.map(e => e.date?.slice(0, 4)).filter(Boolean))].sort().reverse();

  // Filter by year
  const yearFiltered = allExpenses.filter(e => !selectedYear || e.date?.startsWith(selectedYear.toString()));

  // Filter by category
  const expenses = selectedCat ? yearFiltered.filter(e => e.category === selectedCat) : yearFiltered;

  // Budget map for selected year
  let budgetMap = {};
  let totalBudget = 0;
  if (DEMO_MODE) {
    demoBudgetItems.forEach(b => {
      budgetMap[b.category] = b.annualBudget;
      totalBudget += b.annualBudget;
    });
  } else {
    const budgetDB = getDB('budget');
    try {
      if (budgetDB) {
        const bPages = await queryDB(budgetDB);
        bPages.filter(p => {
          const yr = getNumber(p, 'Fiscal Year') || getNumber(p, 'Year');
          return yr === selectedYear || !yr;
        }).forEach(p => {
          const cat = getTitle(p);
          const amt = getNumber(p, 'Annual Budget') || getNumber(p, 'Budgeted Amount') || 0;
          budgetMap[cat] = amt;
          totalBudget += amt;
        });
      }
    } catch(e) {}
  }

  // Category summary
  const catSummary = {};
  yearFiltered.forEach(e => {
    if (!catSummary[e.category]) catSummary[e.category] = { total: 0, count: 0 };
    catSummary[e.category].total += e.amount;
    catSummary[e.category].count++;
  });
  // Include budget categories even if no spending yet
  Object.keys(budgetMap).forEach(cat => {
    if (!catSummary[cat]) catSummary[cat] = { total: 0, count: 0 };
  });
  const catSorted = Object.entries(catSummary).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = yearFiltered.reduce((s, e) => s + e.amount, 0);
  const overallVariance = totalBudget - grandTotal;

  const GOLD = '#d4a853';

  const catColors = {
    'Cleaning': '#6ee7b7', 'Utilities': '#60a5fa', 'Maintenance': '#fbbf24',
    'Management Fee': '#a78bfa', 'Bank Charges': '#94a3b8', 'Security': '#fb923c',
    'Insurance': '#34d399', 'Legal & Compliance': '#f472b6', 'Repairs': '#facc15',
    'Landscaping': '#4ade80', 'Extraordinary': '#f59e0b', 'Uncategorized': '#64748b',
  };
  const getCatColor = (c) => catColors[c] || '#94a3b8';

  return (
    <div className="min-h-screen" style={{ background: '#0a1628', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Header session={session} branding={branding} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="mb-1"><a href="/admin" className="text-sm" style={{ color: GOLD }}>← Dashboard</a></div>
            <h2 className="text-2xl font-bold text-white">💸 Gastos Detallados</h2>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>{expenses.length} entries · {selectedYear}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Year filter */}
            {years.map(y => (
              <a key={y} href={`/admin/expenses?year=${y}${selectedCat ? `&category=${encodeURIComponent(selectedCat)}` : ''}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={parseInt(y) === selectedYear
                  ? { background: GOLD, color: '#0a1628' }
                  : { background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                {y}
              </a>
            ))}
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl p-4" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Total Spent {selectedYear}</p>
            <p className="text-2xl font-bold text-red-400 font-mono mt-1">{fmt(grandTotal)}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>{yearFiltered.length} expenses</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Annual Budget</p>
            <p className="text-2xl font-bold font-mono mt-1" style={{ color: GOLD }}>{fmt(totalBudget)}</p>
            <div className="mt-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className={`h-1.5 rounded-full ${grandTotal > totalBudget ? 'bg-red-400' : 'bg-emerald-400'}`}
                style={{ width: `${totalBudget > 0 ? Math.min(grandTotal / totalBudget * 100, 100) : 0}%` }}></div>
            </div>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>{totalBudget > 0 ? Math.round(grandTotal / totalBudget * 100) : 0}% used</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: `rgba(${overallVariance >= 0 ? '110,231,183' : '248,113,113'},0.06)`, border: `1px solid rgba(${overallVariance >= 0 ? '110,231,183' : '248,113,113'},0.2)` }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Variance</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${overallVariance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {overallVariance >= 0 ? '+' : ''}{fmt(overallVariance)}
            </p>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>{overallVariance >= 0 ? '✓ Under budget' : '⚠ Over budget'}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Largest Expense</p>
            <p className="text-sm font-bold mt-1" style={{ color: GOLD }}>{catSorted[0]?.[0] || '—'}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>{catSorted[0] ? fmt(catSorted[0][1].total) + ' DOP' : ''}</p>
          </div>
        </div>

        {/* Category breakdown — budget vs actual */}
        <div className="rounded-xl p-5 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">By Category — Budget vs. Actual</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Click a category to filter expenses below</p>
            </div>
            {selectedCat && <a href={`/admin/expenses?year=${selectedYear}`} className="text-xs px-3 py-1 rounded-lg" style={{ color: GOLD, background: 'rgba(212,168,83,0.1)' }}>Clear filter ✕</a>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {catSorted.map(([cat, data], i) => {
              const budget = budgetMap[cat] || 0;
              const budgetPct = budget > 0 ? data.total / budget * 100 : null;
              const over = budget > 0 && data.total > budget;
              const shareOfTotal = grandTotal > 0 ? (data.total / grandTotal * 100).toFixed(1) : 0;
              return (
                <a key={i} href={`/admin/expenses?year=${selectedYear}&category=${encodeURIComponent(cat)}`}
                  className="rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.02]"
                  style={{
                    background: selectedCat === cat ? 'rgba(212,168,83,0.1)' : over ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedCat === cat ? 'rgba(212,168,83,0.3)' : over ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: getCatColor(cat) }}>
                      {cat === 'Extraordinary' ? '★ ' : ''}{cat}
                    </span>
                    <span className="text-xs font-mono" style={{ color: over ? '#f87171' : '#64748b' }}>
                      {budgetPct !== null ? Math.round(budgetPct) + '%' : shareOfTotal + '%'}
                    </span>
                  </div>
                  <p className={`text-sm font-bold font-mono ${over ? 'text-red-400' : 'text-white'}`}>{fmt(data.total)}</p>
                  {budget > 0 && (
                    <>
                      <div className="mt-1.5 rounded-full h-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(budgetPct, 100)}%`, background: over ? '#f87171' : getCatColor(cat) }}></div>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                        Budget: {fmt(budget)} {over && <span style={{ color: '#f87171' }}>⚠ over</span>}
                      </p>
                    </>
                  )}
                  {!budget && <p className="text-xs mt-1" style={{ color: '#64748b' }}>{data.count} entries · no budget</p>}
                </a>
              );
            })}
          </div>
        </div>

        {/* Expenses Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold text-white">
              {selectedCat ? `${selectedCat} — ` : ''}{expenses.length} expenses
              {selectedCat && <span className="ml-2 font-mono text-red-400">{fmt(expenses.reduce((s,e)=>s+e.amount,0))} DOP</span>}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Date', 'Description', 'Vendor', 'Category', 'Quarter', 'Status', 'Amount'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    className={`hover:bg-white/5 transition-colors ${e.isExtraordinary ? 'bg-yellow-900/5' : ''}`}>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{e.date}</td>
                    <td className="px-4 py-3 text-white font-medium max-w-xs">
                      {e.description}
                      {e.isExtraordinary && <span className="ml-1 text-xs text-yellow-400">★</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{e.vendor || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={{ color: getCatColor(e.category), background: 'rgba(255,255,255,0.04)' }}>{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{e.quarter || '—'}</td>
                    <td className="px-4 py-3">
                      {e.status && <span className={`inline-flex px-2 py-0.5 rounded text-xs ${e.status === 'Paid' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-yellow-900/40 text-yellow-400'}`}>{e.status}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-white">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              {expenses.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'rgba(212,168,83,0.05)', borderTop: '1px solid rgba(212,168,83,0.15)' }}>
                    <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-right" style={{ color: '#94a3b8' }}>TOTAL</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-400">{fmt(expenses.reduce((s,e)=>s+e.amount,0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
