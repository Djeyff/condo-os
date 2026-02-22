import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber, getSelect, getDate } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.unit && !session.isAdmin) redirect('/');

  const branding = getBranding();
  const unitPageId = session.unitPageId;
  const fmt = (n) => {
    const abs = Math.abs(n || 0);
    const str = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + str;
  };

  // Fetch unit info
  let unitInfo = { unit: session.unit, owner: '', balance: 0, share: 0, status: '' };
  try {
    if (unitPageId) {
      const unitsDB = getDB('units');
      if (unitsDB) {
        const units = await queryDB(unitsDB);
        const u = units.find(p => p.id === unitPageId);
        if (u) {
          unitInfo = {
            unit: getTitle(u),
            owner: getText(u, 'Owner Name'),
            balance: getNumber(u, 'Current Balance') || 0,
            share: getNumber(u, 'Ownership Share (%)') || 0,
            status: getSelect(u, 'Fee Status') || 'Unknown',
          };
        }
      }
    }
  } catch(e) { console.error('Units fetch error:', e.message); }

  // Fetch recent ledger entries
  let recentEntries = [];
  try {
    const ledgerDB = getDB('ledger');
    if (ledgerDB && unitPageId) {
      const entries = await queryDB(ledgerDB,
        { property: 'Unit', relation: { contains: unitPageId } },
        [{ property: 'Date', direction: 'descending' }]
      );
      recentEntries = entries.slice(0, 10).map(e => ({
        date: getDate(e, 'Date'),
        type: getSelect(e, 'Type'),
        description: getTitle(e),
        debit: getNumber(e, 'Debit'),
        credit: getNumber(e, 'Credit'),
      }));
    }
  } catch(e) { console.error('Ledger fetch error:', e.message); }

  // Fetch maintenance requests
  let maintenanceReqs = [];
  try {
    const maintDB = getDB('maintenance');
    if (maintDB && unitPageId) {
      const reqs = await queryDB(maintDB,
        { property: 'Unit', relation: { contains: unitPageId } },
        [{ property: 'Reported Date', direction: 'descending' }]
      );
      maintenanceReqs = reqs.slice(0, 5).map(r => ({
        request: getTitle(r),
        status: getSelect(r, 'Status'),
        priority: getSelect(r, 'Priority'),
        location: getText(r, 'Location'),
        assignedTo: getText(r, 'Assigned To'),
        date: getDate(r, 'Reported Date'),
      }));
    }
  } catch(e) { console.error('Maintenance fetch error:', e.message); }

  // Fetch next meeting
  let nextMeeting = null;
  try {
    const meetingsDB = getDB('meetings');
    if (meetingsDB) {
      const now = new Date().toISOString().slice(0, 10);
      const meetings = await queryDB(meetingsDB,
        { property: 'Date', date: { on_or_after: now } },
        [{ property: 'Date', direction: 'ascending' }]
      );
      if (meetings.length) {
        const m = meetings[0];
        nextMeeting = { title: getTitle(m), date: getDate(m, 'Date') };
      }
    }
  } catch(e) { console.error('Meetings fetch error:', e.message); }

  const openReqs = maintenanceReqs.filter(r => r.status !== 'Resolved' && r.status !== 'Closed').length;

  const statusBadge = (s) => {
    if (s === 'Open') return 'bg-red-100 text-red-700';
    if (s === 'In Progress') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };
  const priorityBadge = (p) => {
    if (p === 'High') return 'bg-red-100 text-red-800';
    if (p === 'Medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <Header buildingName={branding.name} unit={session.unit} isAdmin={session.isAdmin}
        logo={branding.logo} primaryColor={branding.primaryColor} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Welcome, {unitInfo.owner || session.unit}</h2>
          <p className="text-sm mt-1" style={{ color: '#d4a853' }}>Unit {unitInfo.unit} · {branding.currency}</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💰</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Balance</span>
            </div>
            <p className={`text-2xl font-bold ${unitInfo.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(unitInfo.balance)} <span className="text-sm font-normal" style={{ color: '#64748b' }}>{branding.currency}</span>
            </p>
            <p className="text-xs mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                unitInfo.status === 'Current' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>{unitInfo.status}</span>
            </p>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📊</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Ownership Share</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#d4a853' }}>{(unitInfo.share * 100).toFixed(1)}%</p>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔧</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Open Requests</span>
            </div>
            <p className={`text-2xl font-bold ${openReqs > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{openReqs}</p>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📅</span>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>Next Meeting</span>
            </div>
            <p className="text-lg font-bold text-white">{nextMeeting ? nextMeeting.date : 'None'}</p>
            {nextMeeting?.title && <p className="text-xs mt-1" style={{ color: '#64748b' }}>{nextMeeting.title}</p>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-8">
          <a href="/maintenance" className="btn-gold">🔧 New Request</a>
          <a href="/statement" className="btn-primary">📊 Full Statement</a>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
            </div>
            <div>
              {recentEntries.length === 0 && (
                <p className="px-6 py-8 text-sm text-center" style={{ color: '#64748b' }}>No transactions yet.</p>
              )}
              {recentEntries.map((e, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
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

          {/* Maintenance */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-semibold text-white">Maintenance Requests</h3>
              {openReqs > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(212,168,83,0.2)', color: '#d4a853' }}>{openReqs}</span>
              )}
            </div>
            <div>
              {maintenanceReqs.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <p className="text-emerald-400 text-2xl mb-2">✓</p>
                  <p className="text-sm" style={{ color: '#94a3b8' }}>No maintenance requests.</p>
                </div>
              )}
              {maintenanceReqs.map((r, i) => (
                <div key={i} className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{r.request}</p>
                      <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                        {r.location && <span>{r.location} · </span>}
                        {r.date}
                      </p>
                    </div>
                    <div className="flex gap-1.5 ml-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${priorityBadge(r.priority)}`}>{r.priority}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(r.status)}`}>{r.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 py-6 text-center text-xs" style={{ borderTop: '1px solid rgba(212,168,83,0.1)', color: '#64748b' }}>
        Powered by <strong style={{ color: '#d4a853' }}>Condo Manager OS</strong>
      </footer>
    </div>
  );
}
