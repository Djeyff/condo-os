import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getNumber, getSelect, getDate, getText } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';

export default async function ExpensesPage({ searchParams }) {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');

  const branding = getBranding();
  const selectedCat = searchParams?.category || null;
  const selectedYear = searchParams?.year ? parseInt(searchParams.year) : new Date().getFullYear();

  const fmt = (n) => {
    const abs = Math.abs(n || 0);
    return abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const expDB = getDB('expenses');
  let expPages = [];
  try { if (expDB) expPages = await queryDB(expDB, undefined, [{ property: 'Date', direction: 'descending' }]); } catch(e) {}

  const allExpenses = expPages.map(p => ({
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

  // Filter by year
  const yearFiltered = allExpenses.filter(e => !selectedYear || e.date?.startsWith(selectedYear.toString()));

  // Filter by category
  const expenses = selectedCat ? yearFiltered.filter(e => e.category === selectedCat) : yearFiltered;

  // Category summary
  const catSummary = {};
  yearFiltered.forEach(e => {
    if (!catSummary[e.category]) catSummary[e.category] = { total: 0, count: 0 };
    catSummary[e.category].total += e.amount;
    catSummary[e.category].count++;
  });
  const catSorted = Object.entries(catSummary).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = yearFiltered.reduce((s, e) => s + e.amount, 0);

  // Available years
  const years = [...new Set(allExpenses.map(e => e.date?.slice(0, 4)).filter(Boolean))].sort().reverse();

  const GOLD = '#d4a853';

  const catColors = {
    'Cleaning': '#6ee7b7', 'Utilities': '#60a5fa', 'Maintenance': '#fbbf24',
    'Management Fee': '#a78bfa', 'Bank Charges': '#94a3b8', 'Security': '#fb923c',
    'Insurance': '#34d399', 'Legal & Compliance': '#f472b6', 'Repairs': '#facc15',
    'Landscaping': '#4ade80', 'Uncategorized': '#64748b',
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
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Total {selectedYear}</p>
            <p className="text-2xl font-bold text-red-400 font-mono mt-1">{fmt(grandTotal)}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>{yearFiltered.length} expenses</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Categories</p>
            <p className="text-2xl font-bold text-white font-mono mt-1">{catSorted.length}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>distinct categories</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Largest Category</p>
            <p className="text-sm font-bold mt-1" style={{ color: GOLD }}>{catSorted[0]?.[0] || '—'}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>{catSorted[0] ? fmt(catSorted[0][1].total) + ' DOP' : ''}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <p className="text-xs uppercase font-semibold" style={{ color: '#94a3b8' }}>Avg / Expense</p>
            <p className="text-sm font-bold mt-1 text-white">{yearFiltered.length ? fmt(grandTotal / yearFiltered.length) : '0'}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>DOP</p>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="rounded-xl p-5 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white">By Category</p>
            {selectedCat && <a href={`/admin/expenses?year=${selectedYear}`} className="text-xs px-3 py-1 rounded-lg" style={{ color: GOLD, background: 'rgba(212,168,83,0.1)' }}>Clear filter</a>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {catSorted.map(([cat, data], i) => {
              const pct = grandTotal > 0 ? (data.total / grandTotal * 100).toFixed(1) : 0;
              return (
                <a key={i} href={`/admin/expenses?year=${selectedYear}&category=${encodeURIComponent(cat)}`}
                  className="rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.02]"
                  style={{
                    background: selectedCat === cat ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedCat === cat ? 'rgba(212,168,83,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: getCatColor(cat) }}>{cat}</span>
                    <span className="text-xs" style={{ color: '#64748b' }}>{pct}%</span>
                  </div>
                  <p className="text-sm font-bold font-mono text-white">{fmt(data.total)}</p>
                  <div className="mt-1 rounded-full h-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-1 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: getCatColor(cat) }}></div>
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#64748b' }}>{data.count} entries</p>
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
