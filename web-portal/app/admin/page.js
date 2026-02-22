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
  const unitPages = unitsDB ? await queryDB(unitsDB, undefined, [{ property: 'Unit', direction: 'ascending' }]) : [];
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
  const cashPages = cashDB ? await queryDB(cashDB) : [];
  const cashAccounts = cashPages.map(c => ({
    name: getTitle(c),
    balance: getNumber(c, 'Balance') || 0,
    type: getSelect(c, 'Type') || '',
  }));
  const totalCash = cashAccounts.reduce((s, c) => s + c.balance, 0);

  // Budget
  const budgetDB = getDB('budget');
  const budgetPages = budgetDB ? await queryDB(budgetDB) : [];
  const totalBudget = config.building?.annualBudget || budgetPages.reduce((s, b) => s + (getNumber(b, 'Budgeted Amount') || 0), 0);

  // Recent ledger entries
  const ledgerDB = getDB('ledger');
  let recentEntries = [];
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

  // Open maintenance requests
  const maintDB = getDB('maintenance');
  let openRequests = [];
  let totalRequests = 0;
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
    <div className="min-h-screen bg-gray-50">
      <Header buildingName={branding.name} isAdmin={true} logo={branding.logo}
        primaryColor={branding.primaryColor} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1">{units.length} units · {config.building?.currency || 'DOP'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* KPI Cards — Top Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Outstanding */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-500 text-lg">⚠️</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{fmt(totalOutstanding)}</p>
            <p className="text-xs text-gray-400 mt-1">{delinquentCount} delinquent unit{delinquentCount !== 1 ? 's' : ''}</p>
          </div>

          {/* Cash Position */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-emerald-500 text-lg">🏦</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cash Position</span>
            </div>
            <p className={`text-2xl font-bold ${totalCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(totalCash)}</p>
            <p className="text-xs text-gray-400 mt-1">{cashAccounts.length} account{cashAccounts.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Collection Rate */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-500 text-lg">📊</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Collection Rate</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{collectionRate}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className={`h-2 rounded-full ${collectionRate >= 80 ? 'bg-emerald-500' : collectionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${collectionRate}%` }}></div>
            </div>
          </div>

          {/* Annual Budget */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-500 text-lg">📋</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Annual Budget</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(totalBudget)}</p>
            <p className="text-xs text-gray-400 mt-1">{branding.currency}</p>
          </div>

          {/* Maintenance */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-500 text-lg">🔧</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Open Requests</span>
            </div>
            <p className={`text-2xl font-bold ${openRequests.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{openRequests.length}</p>
            <p className="text-xs text-gray-400 mt-1">{totalRequests} total</p>
          </div>
        </div>

        {/* Cash Accounts Row */}
        {cashAccounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {cashAccounts.map((acc, i) => (
              <div key={i} className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{acc.type || 'Account'}</p>
                <p className="text-sm font-semibold mt-1">{acc.name}</p>
                <p className="text-xl font-bold mt-2">{fmt(acc.balance)} <span className="text-sm font-normal text-slate-400">{branding.currency}</span></p>
              </div>
            ))}
          </div>
        )}

        {/* Units Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">All Units</h3>
            <span className="text-xs text-gray-400">{units.length} units</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {units.map((u, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">{u.unit}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{u.owner}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${u.balance < 0 ? 'text-red-600' : u.balance > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {fmt(u.balance)} <span className="text-xs text-gray-400">{branding.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">{u.share ? (u.share * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 px-4" colSpan={2}>
                    <span className="text-gray-500 text-xs uppercase">Total</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-500">{currentCount} current · {delinquentCount} overdue</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    <span className={totalOutstanding + totalPositive < 0 ? 'text-red-600' : 'text-emerald-600'}>
                      {fmt(totalOutstanding + totalPositive)} {branding.currency}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-500">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {recentEntries.length === 0 && (
                <p className="px-6 py-8 text-gray-400 text-sm text-center">No transactions yet.</p>
              )}
              {recentEntries.map((e, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                      e.credit ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {e.credit ? '↓' : '↑'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{e.description}</p>
                      <p className="text-xs text-gray-400">{e.date} · <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        e.type?.includes('Payment') ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>{e.type}</span></p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {e.credit ? (
                      <span className="text-sm font-semibold text-emerald-600">+{fmt(e.credit)}</span>
                    ) : (
                      <span className="text-sm font-semibold text-red-500">-{fmt(e.debit)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Maintenance */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Open Maintenance</h3>
              {openRequests.length > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {openRequests.length}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {openRequests.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <p className="text-emerald-600 text-2xl mb-2">✓</p>
                  <p className="text-gray-500 text-sm">All clear — no open requests.</p>
                </div>
              )}
              {openRequests.map((r, i) => (
                <div key={i} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{r.request}</p>
                      <p className="text-xs text-gray-500 mt-1">
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
      <footer className="mt-12 border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        Powered by <strong>Condo Manager OS</strong> · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
