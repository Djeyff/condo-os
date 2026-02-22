import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getText, getSelect, getDate } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import MaintenanceForm from './MaintenanceForm';

export default async function MaintenancePage() {
  const session = await getSession();
  if (!session.unit) redirect('/');
  const branding = getBranding();

  let requests = [];
  try {
    const maintDB = getDB('maintenance');
    if (maintDB && session.unitPageId) {
      const raw = await queryDB(maintDB,
        { property: 'Unit', relation: { contains: session.unitPageId } },
        [{ property: 'Reported Date', direction: 'descending' }]
      );
      requests = raw.map(r => ({
        request: getTitle(r), status: getSelect(r, 'Status'), priority: getSelect(r, 'Priority'),
        location: getText(r, 'Location'), date: getDate(r, 'Reported Date'),
      }));
    }
  } catch(e) { console.error('Maintenance error:', e.message); }

  const statusBadge = (s) => {
    if (s === 'Open') return 'bg-red-100 text-red-700';
    if (s === 'In Progress') return 'bg-amber-100 text-amber-700';
    if (s === 'Resolved') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-600';
  };
  const priorityBadge = (p) => {
    if (p === 'High') return 'bg-red-100 text-red-800';
    if (p === 'Medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <Header buildingName={branding.name} unit={session.unit} logo={branding.logo} primaryColor={branding.primaryColor} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-white mb-8">Maintenance Requests</h2>

        {/* New Request Form */}
        <div className="rounded-xl p-6 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-lg font-semibold text-white mb-4">Submit New Request</h3>
          <MaintenanceForm unit={session.unit} unitPageId={session.unitPageId} />
        </div>

        {/* Existing Requests */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-lg font-semibold text-white">Your Requests ({requests.length})</h3>
          </div>
          <div>
            {requests.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-emerald-400 text-2xl mb-2">✓</p>
                <p className="text-sm" style={{ color: '#94a3b8' }}>No requests submitted yet.</p>
              </div>
            )}
            {requests.map((r, i) => (
              <div key={i} className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{r.request}</p>
                    <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                      {r.location && <span>{r.location} · </span>}{r.date}
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
      </main>

      <footer className="mt-12 py-6 text-center text-xs" style={{ borderTop: '1px solid rgba(212,168,83,0.1)', color: '#64748b' }}>
        Powered by <strong style={{ color: '#d4a853' }}>Condo Manager OS</strong>
      </footer>
    </div>
  );
}
