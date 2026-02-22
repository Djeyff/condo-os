import { getSession } from '@/lib/auth';
import { getBranding, getDB, getConfig } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber, getSelect, getDate } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';

export default async function AdminPage() {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');

  const branding = getBranding();
  const config = getConfig();
  const fmt = (n) => {
    const abs = Math.abs(n || 0);
    const str = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + str;
  };

  // Fetch all units
  const unitsDB = getDB('units');
  let unitPages = [];
  try { if (unitsDB) unitPages = await queryDB(unitsDB, undefined, [{ property: 'Unit', direction: 'ascending' }]); } catch(e) { console.error('Units fetch error:', e.message); }
  const units = unitPages.map(u => ({
    unit: getTitle(u),
    owner: getText(u, 'Owner Name'),
    balance: getNumber(u, 'Current Balance') || 0,
    share: getNumber(u, 'Ownership Share (%)') || 0,
    status: getSelect(u, 'Fee Status') || 'Unknown',
  }));

  const totalOutstanding = units.reduce((s, u) => s + Math.min(0, u.balance), 0);
  const totalPositive = units.reduce((s, u) => s + Math.max(0, u.balance), 0);
  const delinquentCount = units.filter(u => u.balance < 0).length;
  const currentCount = units.filter(u => u.balance >= 0).length;

  // Fetch cash position
  const cashDB = getDB('cashPosition');
  let cashPages = [];
  try { if (cashDB) cashPages = await queryDB(cashDB); } catch(e) { console.error('Cash fetch error:', e.message); }
  const cashAccounts = cashPages.map(c => ({
    name: getTitle(c),
    balance: getNumber(c, 'Current Balance') || getNumber(c, 'Balance') || 0,
    type: getSelect(c, 'Account Type') || getSelect(c, 'Type') || '',
  }));
  const totalCash = cashAccounts.reduce((s, c) => s + c.balance, 0);

  // Budget
  const budgetDB = getDB('budget');
  let budgetPages = [];
  try { if (budgetDB) budgetPages = await queryDB(budgetDB); } catch(e) { console.error('Budget fetch error:', e.message); }
  const totalBudget = config.building?.annualBudget || budgetPages.reduce((s, b) => s + (getNumber(b, 'Budgeted Amount') || 0), 0);

  // Recent ledger entries
  const ledgerDB = getDB('ledger');
  let recentEntries = [];
  try {
    if (ledgerDB) {
      const entries = await queryDB(ledgerDB, undefined, [{ property: 'Date', direction: 'descending' }]);
      recentEntries = entries.slice(0, 12).map(e => ({
        date: getDate(e, 'Date'),
        type: getSelect(e, 'Type'),
        description: getTitle(e),
        debit: getNumber(e, 'Debit'),
        credit: getNumber(e, 'Credit'),
      }));
    }
  } catch(e) { console.error('Ledger fetch error:', e.message); }

  // Open maintenance requests
  const maintDB = getDB('maintenance');
  let openRequests = [];
  let totalRequests = 0;
  try {
    if (maintDB) {
      const allReqs = await queryDB(maintDB, undefined, [{ property: 'Reported Date', direction: 'descending' }]);
      totalRequests = allReqs.length;
      openRequests = allReqs.filter(r => {
        const st = getSelect(r, 'Status');
        return st === 'Open' || st === 'In Progress';
      }).map(r => ({
        request: getTitle(r),
        status: getSelect(r, 'Status'),
        priority: getSelect(r, 'Priority'),
        location: getText(r, 'Location'),
        assignedTo: getText(r, 'Assigned To'),
        date: getDate(r, 'Reported Date'),
      }));
    }
  } catch(e) { console.error('Maintenance fetch error:', e.message); }

  // Collection rate
  const collectionRate = units.length > 0 ? Math.round((currentCount / units.length) * 100) : 0;

  // Status color helper
  const statusColor = (status) => {
    if (status === 'Current') return 'bg-emerald-100 text-emerald-800';
    if (status?.includes('1-30')) return 'bg-yellow-100 text-yellow-800';
    if (status?.includes('31-60')) return 'bg-orange-100 text-orange-800';
    if (status?.includes('61-90') || status?.includes('90+')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-600';
  };

  const priorityColor = (p) => {
    if (p === 'High') return 'bg-red-100 text-red-800';
    if (p === 'Medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const maintStatusColor = (s) => {
    if (s === 'Open') return 'bg-red-100 text-red-700';
    if (s === 'In Progress') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <Header buildingName={branding.name} isAdmin={true} logo={branding.logo}
        primaryColor={branding.primaryColor} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
            <p className="text-sm mt-1" style={{ color: '#d4a853' }}>{units.length} units · {config.building?.currency || 'DOP'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* KPI Cards — Top Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Outstanding */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚠️</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Outstanding</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{fmt(totalOutstanding)}</p>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>{delinquentCount} delinquent unit{delinquentCount !== 1 ? 's' : ''}</p>
          </div>

          {/* Cash Position */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🏦</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Cash Position</span>
            </div>
            <p className={`text-2xl font-bold ${totalCash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(totalCash)}</p>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>{cashAccounts.length} account{cashAccounts.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Collection Rate */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📊</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Collection Rate</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#d4a853' }}>{collectionRate}%</p>
            <div className="w-full rounded-full h-2 mt-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className={`h-2 rounded-full ${collectionRate >= 80 ? 'bg-emerald-400' : collectionRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${collectionRate}%` }}></div>
            </div>
          </div>

          {/* Annual Budget */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📋</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Annual Budget</span>
            </div>
            <p className="text-2xl font-bold text-white">{fmt(totalBudget)}</p>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>{branding.currency}</p>
          </div>

          {/* Maintenance */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔧</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Open Requests</span>
            </div>
            <p className={`text-2xl font-bold ${openRequests.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{openRequests.length}</p>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>{totalRequests} total</p>
          </div>
        </div>

        {/* Cash Accounts Row */}
        {cashAccounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {cashAccounts.map((acc, i) => (
              <div key={i} className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, rgba(212,168,83,0.1), rgba(212,168,83,0.05))', border: '1px solid rgba(212,168,83,0.2)' }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#d4a853' }}>{acc.type || 'Account'}</p>
                <p className="text-sm font-semibold mt-1 text-white">{acc.name}</p>
                <p className="text-xl font-bold mt-2 text-white">{fmt(acc.balance)} <span className="text-sm font-normal" style={{ color: '#94a3b8' }}>{branding.currency}</span></p>
              </div>
            ))}
          </div>
        )}

        {/* Units Table */}
        <div className="rounded-xl mb-8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-lg font-semibold text-white">All Units</h3>
            <span className="text-xs" style={{ color: '#64748b' }}>{units.length} units</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Unit</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Owner</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Balance</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u, i) => (
                  <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(212,168,83,0.05)'}
                    onMouseOut={e => e.currentTarget.style.background = 'none'}>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold"
                        style={{ background: 'rgba(212,168,83,0.15)', color: '#d4a853' }}>{u.unit}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-white">{u.owner}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${u.balance < 0 ? 'text-red-400' : u.balance > 0 ? 'text-emerald-400' : ''}`}
                      style={u.balance === 0 ? { color: '#64748b' } : {}}>
                      {fmt(u.balance)} <span className="text-xs" style={{ color: '#64748b' }}>{branding.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: '#94a3b8' }}>{u.share ? (u.share * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold" style={{ background: 'rgba(212,168,83,0.05)', borderTop: '1px solid rgba(212,168,83,0.15)' }}>
                  <td className="py-3 px-4" colSpan={2}>
                    <span className="text-xs uppercase" style={{ color: '#d4a853' }}>Total</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs" style={{ color: '#94a3b8' }}>{currentCount} current · {delinquentCount} overdue</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    <span className={totalOutstanding + totalPositive < 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {fmt(totalOutstanding + totalPositive)} {branding.currency}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right" style={{ color: '#94a3b8' }}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            </div>
            <div>
              {recentEntries.length === 0 && (
                <p className="px-6 py-8 text-sm text-center" style={{ color: '#64748b' }}>No transactions yet.</p>
              )}
              {recentEntries.map((e, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                      e.credit ? 'text-emerald-400' : 'text-red-400'
                    }`} style={{ background: e.credit ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)' }}>
                      {e.credit ? '↓' : '↑'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{e.description}</p>
                      <p className="text-xs" style={{ color: '#64748b' }}>{e.date} · <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ background: e.type?.includes('Payment') ? 'rgba(52,211,153,0.1)' : 'rgba(212,168,83,0.1)', color: e.type?.includes('Payment') ? '#6ee7b7' : '#d4a853' }}>{e.type}</span></p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {e.credit ? (
                      <span className="text-sm font-semibold text-emerald-400">+{fmt(e.credit)}</span>
                    ) : (
                      <span className="text-sm font-semibold text-red-400">-{fmt(e.debit)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Maintenance */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-semibold text-white">Open Maintenance</h3>
              {openRequests.length > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(212,168,83,0.2)', color: '#d4a853' }}>
                  {openRequests.length}
                </span>
              )}
            </div>
            <div>
              {openRequests.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <p className="text-emerald-400 text-2xl mb-2">✓</p>
                  <p className="text-sm" style={{ color: '#94a3b8' }}>All clear — no open requests.</p>
                </div>
              )}
              {openRequests.map((r, i) => (
                <div key={i} className="px-6 py-4 transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{r.request}</p>
                      <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                        {r.location && <span>{r.location} · </span>}
                        {r.assignedTo && <span>→ {r.assignedTo} · </span>}
                        {r.date}
                      </p>
                    </div>
                    <div className="flex gap-1.5 ml-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColor(r.priority)}`}>
                        {r.priority}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${maintStatusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-xs" style={{ borderTop: '1px solid rgba(212,168,83,0.1)', color: '#64748b' }}>
        Powered by <strong style={{ color: '#d4a853' }}>Condo Manager OS</strong> · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
