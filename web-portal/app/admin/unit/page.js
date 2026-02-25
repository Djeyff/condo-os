import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber, getSelect, getDate } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import PrintButton from '@/components/PrintButton';
import { DEMO_MODE, demoBranding, demoUnits, demoUnitLedger, demoMaintenanceRequests } from '@/lib/demoData';

export default async function AdminUnitPage({ searchParams }) {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');
  const branding = DEMO_MODE ? demoBranding : getBranding();
  const params = await searchParams;
  const selectedId = params?.id || null;

  const fmt = (n) => {
    const abs = Math.abs(n || 0);
    const str = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + str;
  };

  // Fetch all units for selector
  let allUnits = [];
  if (DEMO_MODE) {
    allUnits = demoUnits.map((u, i) => ({ ...u, id: u.unit }));
  } else {
    try {
      const unitsDB = getDB('units');
      if (unitsDB) {
        const pages = await queryDB(unitsDB, undefined, [{ property: 'Unit', direction: 'ascending' }]);
        allUnits = pages.map(p => ({
          id: p.id,
          unit: getTitle(p),
          owner: getText(p, 'Owner Name'),
          balance: getNumber(p, 'Current Balance') || 0,
          share: getNumber(p, 'Ownership Share (%)') || 0,
          status: getSelect(p, 'Fee Status') || 'Unknown',
        }));
      }
    } catch(e) { console.error('Units error:', e.message); }
  }

  // Selected unit data
  const unitInfo = allUnits.find(u => u.id === selectedId) || null;

  // Fetch ledger for selected unit
  let entries = [];
  let recentEntries = [];
  if (DEMO_MODE && selectedId) {
    const raw = demoUnitLedger[selectedId] || [];
    let running = 0;
    entries = raw.map(e => {
      running = running - (e.debit || 0) + (e.credit || 0);
      return { ...e, debit: e.debit || null, credit: e.credit || null, balance: running };
    });
    recentEntries = [...entries].reverse().slice(0, 10);
  } else {
    try {
      const ledgerDB = getDB('ledger');
      if (ledgerDB && selectedId) {
        const raw = await queryDB(ledgerDB,
          { property: 'Unit', relation: { contains: selectedId } },
          [{ property: 'Date', direction: 'ascending' }]
        );
        let running = 0;
        entries = raw.map(e => {
          const debit = getNumber(e, 'Debit') || 0;
          const credit = getNumber(e, 'Credit') || 0;
          running = running - debit + credit;
          return { date: getDate(e, 'Date'), type: getSelect(e, 'Type'), description: getTitle(e),
            debit: debit || null, credit: credit || null, balance: running };
        });
        recentEntries = [...entries].reverse().slice(0, 10);
      }
    } catch(e) { console.error('Ledger error:', e.message); }
  }

  // Fetch maintenance for selected unit
  let maintenanceReqs = [];
  if (DEMO_MODE && selectedId) {
    maintenanceReqs = demoMaintenanceRequests
      .filter(r => r.unit === selectedId)
      .map(r => ({ request: r.title, status: r.status, priority: r.priority, location: '', date: r.date }));
  } else {
    try {
      const maintDB = getDB('maintenance');
      if (maintDB && selectedId) {
        const reqs = await queryDB(maintDB,
          { property: 'Unit', relation: { contains: selectedId } },
          [{ property: 'Reported Date', direction: 'descending' }]
        );
        maintenanceReqs = reqs.map(r => ({
          request: getTitle(r), status: getSelect(r, 'Status'), priority: getSelect(r, 'Priority'),
          location: getText(r, 'Location'), date: getDate(r, 'Reported Date'),
        }));
      }
    } catch(e) { console.error('Maintenance error:', e.message); }
  }

  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
  const openReqs = maintenanceReqs.filter(r => r.status === 'Open' || r.status === 'In Progress').length;

  const statusBadge = (s) => {
    if (s === 'Current') return 'bg-emerald-100 text-emerald-800';
    if (s?.includes('1-30')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };
  const maintStatusBadge = (s) => {
    if (s === 'Open') return 'bg-red-100 text-red-700';
    if (s === 'In Progress') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <Header buildingName={branding.name} isAdmin={true} logo={branding.logo} primaryColor={branding.primaryColor} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Unit Viewer</h2>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Admin view — select a unit to see their account</p>
          </div>
          <a href="/admin" className="text-sm font-medium px-4 py-2 rounded-lg" style={{ color: '#d4a853', background: 'rgba(212,168,83,0.1)' }}>← Back to Dashboard</a>
        </div>

        {/* Unit Selector */}
        <div className="rounded-xl p-6 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {allUnits.map(u => (
              <a key={u.id} href={`/admin/unit?id=${u.id}`}
                className="rounded-lg p-3 text-center transition-all"
                style={u.id === selectedId
                  ? { background: 'linear-gradient(135deg, #d4a853, #c49a45)', color: '#0f1a2e' }
                  : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }
                }>
                <p className="text-sm font-bold">{u.unit}</p>
                <p className="text-xs mt-0.5" style={u.id === selectedId ? { color: '#0f1a2e', opacity: 0.7 } : { color: '#64748b' }}>
                  {fmt(u.balance)}
                </p>
              </a>
            ))}
          </div>
        </div>

        {!unitInfo && (
          <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-3xl mb-3">🏠</p>
            <p className="text-lg font-semibold text-white">Select a unit above</p>
            <p className="text-sm" style={{ color: '#64748b' }}>View their balance, transactions, maintenance requests, and generate statements.</p>
          </div>
        )}

        {unitInfo && (
          <>
            {/* Unit Header */}
            <div className="rounded-xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{unitInfo.unit} — {unitInfo.owner}</h3>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mt-2 ${statusBadge(unitInfo.status)}`}>{unitInfo.status}</span>
                </div>
                <PrintButton />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-6 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Balance</p>
                  <p className={`text-lg sm:text-2xl font-bold ${unitInfo.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {fmt(unitInfo.balance)} <span className="text-xs sm:text-sm" style={{ color: '#64748b' }}>{branding.currency}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Share</p>
                  <p className="text-lg sm:text-2xl font-bold" style={{ color: '#d4a853' }}>{unitInfo.share.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: '#64748b' }}>Open Reqs</p>
                  <p className={`text-lg sm:text-2xl font-bold ${openReqs > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{openReqs}</p>
                </div>
              </div>
            </div>

            {/* Full Statement */}
            <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="text-lg font-semibold text-white">Full Statement ({entries.length} transactions)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Type</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Description</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Debit</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Credit</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="py-2.5 px-4" style={{ color: '#94a3b8' }}>{e.date || '—'}</td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: e.type?.includes('Payment') ? 'rgba(52,211,153,0.1)' : 'rgba(212,168,83,0.1)',
                              color: e.type?.includes('Payment') ? '#6ee7b7' : '#d4a853' }}>{e.type}</span>
                        </td>
                        <td className="py-2.5 px-4 text-white">{e.description}</td>
                        <td className="py-2.5 px-4 text-right text-red-400 font-mono">{e.debit ? fmt(e.debit) : ''}</td>
                        <td className="py-2.5 px-4 text-right text-emerald-400 font-mono">{e.credit ? fmt(e.credit) : ''}</td>
                        <td className={`py-2.5 px-4 text-right font-mono font-medium ${e.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold" style={{ background: 'rgba(212,168,83,0.05)', borderTop: '2px solid rgba(212,168,83,0.15)' }}>
                      <td colSpan={3} className="py-3 px-4 text-right" style={{ color: '#d4a853' }}>Totals</td>
                      <td className="py-3 px-4 text-right text-red-400 font-mono">{fmt(totalDebit)}</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-mono">{fmt(totalCredit)}</td>
                      <td className={`py-3 px-4 text-right font-mono ${unitInfo.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {fmt(unitInfo.balance)} {branding.currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Maintenance */}
            {maintenanceReqs.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 className="text-lg font-semibold text-white">Maintenance Requests ({maintenanceReqs.length})</h3>
                </div>
                <div>
                  {maintenanceReqs.map((r, i) => (
                    <div key={i} className="px-6 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <div>
                        <p className="text-sm font-medium text-white">{r.request}</p>
                        <p className="text-xs" style={{ color: '#64748b' }}>{r.location && `${r.location} · `}{r.date}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${maintStatusBadge(r.status)}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-12 py-6 text-center text-xs" style={{ borderTop: '1px solid rgba(212,168,83,0.1)', color: '#64748b' }}>
        Powered by <strong style={{ color: '#d4a853' }}>Condo Manager OS</strong>
      </footer>
    </div>
  );
}
