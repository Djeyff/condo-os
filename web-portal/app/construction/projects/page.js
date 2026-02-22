import { getConstructionDB } from '@/lib/config';
import { queryDB, getTitle, getNumber, getSelect, getDate } from '@/lib/notion';
import ConstructionNav from '@/components/ConstructionNav';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const fmt = (n) => { const a=Math.abs(n||0); return (n<0?'-':'')+a.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}); };

  let projects=[], todoCosto=[];
  try { const db=getConstructionDB('projects'); if(db) projects=await queryDB(db); } catch(e){}
  try { const db=getConstructionDB('todoCosto'); if(db) todoCosto=await queryDB(db); } catch(e){}

  const projectData = projects.map(p => ({
    name: getTitle(p), status: getSelect(p,'Status'), progress: getNumber(p,'Progress %')||0,
    budget: getNumber(p,'Estimated Budget')||0, contract: getNumber(p,'Contract Value')||0,
    committed: getNumber(p,'Committed Budget')||0,
    start: getDate(p,'Start Date'), end: getDate(p,'End Date'), type: getSelect(p,'Project Type'),
  })).sort((a,b) => {
    const order = ['On Site','Active','Mobilizing','Paused','Punch List','Bidding','Prospect','Completed','Closed'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  const todoData = todoCosto.map(t => ({
    name: getTitle(t), budget: getNumber(t,'Presupuesto Total')||0,
    pending: t.properties?.Pendiente?.formula?.number||0, status: getSelect(t,'Estado'),
    start: getDate(t,'Fecha inicio'),
  }));

  const statusColor = (s) => {
    if(s==='On Site'||s==='Active') return 'bg-emerald-100 text-emerald-800';
    if(s==='Mobilizing') return 'bg-blue-100 text-blue-800';
    if(s==='Paused') return 'bg-yellow-100 text-yellow-800';
    if(s==='Completed'||s==='Closed') return 'bg-gray-100 text-gray-600';
    return 'bg-purple-100 text-purple-800';
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <ConstructionNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Projects</h2>

        {/* Project Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {projectData.map((p,i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-white">{p.name}</h3>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(p.status)}`}>{p.status}</span>
              </div>
              {p.type && <p className="text-xs mb-3" style={{ color: '#64748b' }}>{p.type} · {p.start||'No start'} → {p.end||'No end'}</p>}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 rounded-full h-2.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className={`h-2.5 rounded-full ${p.progress>=80?'bg-emerald-400':p.progress>=40?'bg-yellow-400':'bg-blue-400'}`}
                    style={{ width: `${Math.min(p.progress,100)}%` }}></div>
                </div>
                <span className="text-sm font-bold" style={{ color: '#d4a853' }}>{p.progress}%</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-xs" style={{ color: '#64748b' }}>Budget</p>
                  <p className="text-sm font-mono font-semibold text-white">{p.budget ? fmt(p.budget) : '—'}</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-xs" style={{ color: '#64748b' }}>Contract</p>
                  <p className="text-sm font-mono font-semibold text-white">{p.contract ? fmt(p.contract) : '—'}</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-xs" style={{ color: '#64748b' }}>Committed</p>
                  <p className="text-sm font-mono font-semibold text-white">{p.committed ? fmt(p.committed) : '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Todo Costo */}
        {todoData.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-white mb-4">A Todo Costo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todoData.map((t,i) => {
                const spent = t.budget - Math.max(0,t.pending);
                const pct = t.budget > 0 ? Math.round((spent/t.budget)*100) : 0;
                return (
                  <div key={i} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-white">{t.name}</h3>
                      <span className="text-xs" style={{ color: '#64748b' }}>{t.status} · {t.start||''}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 rounded-full h-2.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className={`h-2.5 rounded-full ${pct>=90?'bg-red-400':pct>=70?'bg-yellow-400':'bg-emerald-400'}`}
                          style={{ width: `${Math.min(pct,100)}%` }}></div>
                      </div>
                      <span className="text-sm font-bold" style={{ color: '#d4a853' }}>{pct}%</span>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: '#94a3b8' }}>
                      <span>Spent: {fmt(spent)} DOP</span>
                      <span>Budget: {fmt(t.budget)} DOP</span>
                      <span className={t.pending > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                        Pending: {fmt(Math.max(0,t.pending))} DOP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
