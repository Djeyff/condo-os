import { getConstructionDB } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber, getSelect, getDate, getCheckbox } from '@/lib/notion';
import ConstructionNav from '@/components/ConstructionNav';

export const dynamic = 'force-dynamic';

export default async function ConstructionDashboard() {
  const fmt = (n) => { const a=Math.abs(n||0); return (n<0?'-':'')+a.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}); };
  const today = new Date().toISOString().slice(0,10);
  const weekAgo = new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const monthStart = today.slice(0,8)+'01';

  // Fetch all data
  let expenses=[], timesheets=[], projects=[], people=[], todoCosto=[];
  let mantPlantas=[], mantCamioneta=[];

  try { const db=getConstructionDB('expenses'); if(db) expenses=await queryDB(db); } catch(e){}
  try { const db=getConstructionDB('timesheets'); if(db) timesheets=await queryDB(db); } catch(e){}
  try { const db=getConstructionDB('projects'); if(db) projects=await queryDB(db); } catch(e){}
  try { const db=getConstructionDB('people'); if(db) people=await queryDB(db); } catch(e){}
  try { const db=getConstructionDB('todoCosto'); if(db) todoCosto=await queryDB(db); } catch(e){}
  try { const db=getConstructionDB('mantPlantas'); if(db) mantPlantas=await queryDB(db); } catch(e){}
  try { const db=getConstructionDB('mantCamioneta'); if(db) mantCamioneta=await queryDB(db); } catch(e){}

  // Process expenses
  const expenseData = expenses.map(e => ({
    desc: getTitle(e), amount: getNumber(e,'Amount')||0, date: getDate(e,'Date'),
    status: getSelect(e,'Status'), category: getSelect(e,'Category'), paidFrom: getSelect(e,'Paid From'),
  }));
  const pendingReimb = expenseData.filter(e=>e.status==='Pending Reimbursement');
  const thisMonthExp = expenseData.filter(e=>e.date>=monthStart);
  const thisWeekExp = expenseData.filter(e=>e.date>=weekAgo);
  const totalPendingReimb = pendingReimb.reduce((s,e)=>s+e.amount,0);
  const totalMonthExp = thisMonthExp.reduce((s,e)=>s+e.amount,0);

  // Process timesheets
  const tsData = timesheets.map(t => ({
    task: getTitle(t), hours: getNumber(t,'Hours')||0, date: getDate(t,'Date'),
    status: getSelect(t,'Status'), empPay: getSelect(t,'Employee payment status'),
    amount: getNumber(t,'Fixed Amount')||0, approved: getCheckbox(t,'Approved'),
  }));
  const pendingTsPay = tsData.filter(t=>t.empPay==='Not Paid');
  const thisWeekTs = tsData.filter(t=>t.date>=weekAgo);
  const totalPendingTsPay = pendingTsPay.reduce((s,t)=>s+t.amount,0);
  const weekHours = thisWeekTs.reduce((s,t)=>s+t.hours,0);

  // Process projects
  const projectData = projects.map(p => ({
    name: getTitle(p), status: getSelect(p,'Status'), progress: getNumber(p,'Progress %')||0,
    budget: getNumber(p,'Estimated Budget')||0, contract: getNumber(p,'Contract Value')||0,
    start: getDate(p,'Start Date'), end: getDate(p,'End Date'),
  }));
  const activeProjects = projectData.filter(p=>['Active','On Site','Mobilizing'].includes(p.status));

  // Process todo costo
  const todoData = todoCosto.map(t => ({
    name: getTitle(t), budget: getNumber(t,'Presupuesto Total')||0,
    pending: t.properties?.Pendiente?.formula?.number||0,
    status: getSelect(t,'Estado'),
  }));

  // Maintenance alerts
  const lastCamioneta = mantCamioneta.length ? mantCamioneta.sort((a,b)=>(getDate(b,'Fecha')||'').localeCompare(getDate(a,'Fecha')||''))[0] : null;
  const camKm = lastCamioneta ? getNumber(lastCamioneta,'Odómetro (km)')||0 : 0;
  const camNextKm = lastCamioneta ? getNumber(lastCamioneta,'Próximo km')||0 : 0;
  const kmRemaining = camNextKm - camKm;

  // Recent expenses (last 7 days)
  const recentExp = [...expenseData].filter(e=>e.date>=weekAgo).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  // Expense by category (this month)
  const catTotals = {};
  thisMonthExp.forEach(e => { catTotals[e.category||'Other'] = (catTotals[e.category||'Other']||0)+e.amount; });
  const catSorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const maxCat = catSorted.length ? catSorted[0][1] : 1;

  // Pending payments by client (from pending reimbursement expenses + timesheets)
  const pendingByStatus = {};
  pendingReimb.forEach(e => { pendingByStatus[e.status]=(pendingByStatus[e.status]||0)+e.amount; });
  const pendingTsReimb = tsData.filter(t=>t.status==='Pending Reimbursement');
  const totalPendingTsReimb = pendingTsReimb.reduce((s,t)=>s+t.amount,0);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <ConstructionNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm mt-1" style={{ color: '#d4a853' }}>
            {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </p>
        </div>

        {/* KPIs Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <KPI icon="💸" label="Pending Reimbursement" value={`${fmt(totalPendingReimb)} DOP`} color="red" sub={`${pendingReimb.length} expenses`} />
          <KPI icon="👷" label="Unpaid Workers" value={`${fmt(totalPendingTsPay)} DOP`} color="red" sub={`${pendingTsPay.length} timesheets`} />
          <KPI icon="📊" label="Month Expenses" value={`${fmt(totalMonthExp)} DOP`} color="blue" sub={`${thisMonthExp.length} entries`} />
          <KPI icon="⏱️" label="Week Hours" value={`${weekHours}h`} color="gold" sub={`${thisWeekTs.length} entries`} />
          <KPI icon="🏗️" label="Active Projects" value={activeProjects.length} color="green" sub={`${projectData.length} total`} />
        </div>

        {/* KPIs Row 2 — Alerts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPI icon="🔧" label="Camioneta Service" value={kmRemaining > 0 ? `${fmt(kmRemaining)} km left` : 'OVERDUE'}
            color={kmRemaining <= 1000 ? 'red' : 'green'} sub={`at ${fmt(camKm)} km`} />
          <KPI icon="💰" label="Client Reimbursements" value={`${fmt(totalPendingReimb + totalPendingTsReimb)} DOP`}
            color="red" sub="expenses + timesheets" />
          <KPI icon="📋" label="Todo Costo Pendiente" value={`${fmt(todoData.reduce((s,t)=>s+Math.max(0,t.pending),0))} DOP`}
            color="gold" sub={`${todoData.length} projects`} />
          <KPI icon="🏢" label="Projects On Site" value={projectData.filter(p=>p.status==='On Site').length}
            color="blue" sub={`${projectData.filter(p=>p.status==='Active').length} active`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Expenses */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-semibold text-white">Recent Expenses</h3>
              <a href="/construction/expenses" className="text-xs" style={{ color: '#d4a853' }}>View all →</a>
            </div>
            <div>
              {recentExp.slice(0,8).map((e,i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{e.desc}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{e.date} · <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853' }}>{e.category}</span>
                      {e.status==='Pending Reimbursement' && <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Pending</span>}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-white ml-4">{fmt(e.amount)}</span>
                </div>
              ))}
              {recentExp.length===0 && <p className="px-6 py-8 text-center text-sm" style={{ color: '#64748b' }}>No recent expenses.</p>}
            </div>
          </div>

          {/* Expense by Category (bar chart) */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-semibold text-white">Expenses by Category <span className="text-xs font-normal" style={{ color: '#64748b' }}>this month</span></h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              {catSorted.map(([cat,amt],i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: '#94a3b8' }}>{cat}</span>
                    <span className="font-mono text-white">{fmt(amt)}</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-2 rounded-full" style={{ width: `${(amt/maxCat)*100}%`, background: 'linear-gradient(90deg, #d4a853, #c49a45)' }}></div>
                  </div>
                </div>
              ))}
              {catSorted.length===0 && <p className="text-center text-sm py-4" style={{ color: '#64748b' }}>No expenses this month.</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Active Projects */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-semibold text-white">Active Projects</h3>
              <a href="/construction/projects" className="text-xs" style={{ color: '#d4a853' }}>View all →</a>
            </div>
            <div>
              {activeProjects.map((p,i) => (
                <div key={i} className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">{p.status}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(p.progress,100)}%` }}></div>
                      </div>
                    </div>
                    <span className="text-xs font-mono" style={{ color: '#d4a853' }}>{p.progress}%</span>
                    {p.budget>0 && <span className="text-xs" style={{ color: '#64748b' }}>{fmt(p.budget)} DOP</span>}
                  </div>
                </div>
              ))}
              {activeProjects.length===0 && <p className="px-6 py-8 text-center text-sm" style={{ color: '#64748b' }}>No active projects.</p>}
            </div>
          </div>

          {/* Todo Costo */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-lg font-semibold text-white">A Todo Costo</h3>
            </div>
            <div>
              {todoData.map((t,i) => {
                const spent = t.budget - Math.max(0,t.pending);
                const pct = t.budget > 0 ? Math.round((spent/t.budget)*100) : 0;
                return (
                  <div key={i} className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <span className="text-xs font-mono" style={{ color: t.pending>0 ? '#d4a853' : '#6ee7b7' }}>
                        {t.pending>0 ? `${fmt(t.pending)} pending` : '✓ Complete'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 rounded-full h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className={`h-2 rounded-full ${pct>=90?'bg-red-400':pct>=70?'bg-yellow-400':'bg-emerald-400'}`}
                          style={{ width: `${Math.min(pct,100)}%` }}></div>
                      </div>
                      <span className="text-xs" style={{ color: '#94a3b8' }}>{pct}% · {fmt(spent)}/{fmt(t.budget)}</span>
                    </div>
                  </div>
                );
              })}
              {todoData.length===0 && <p className="px-6 py-8 text-center text-sm" style={{ color: '#64748b' }}>No projects.</p>}
            </div>
          </div>
        </div>

        {/* Unpaid Workers */}
        {pendingTsPay.length > 0 && (
          <div className="rounded-xl overflow-hidden mb-8" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(248,113,113,0.1)' }}>
              <h3 className="text-lg font-semibold text-red-400">⚠️ Unpaid Workers ({pendingTsPay.length})</h3>
            </div>
            <div>
              {pendingTsPay.slice(0,10).map((t,i) => (
                <div key={i} className="px-6 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <p className="text-sm text-white">{t.task}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{t.date} · {t.hours}h</p>
                  </div>
                  <span className="text-sm font-semibold text-red-400">{fmt(t.amount)} DOP</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <footer className="mt-12 py-6 text-center text-xs" style={{ borderTop: '1px solid rgba(212,168,83,0.1)', color: '#64748b' }}>
        Powered by <strong style={{ color: '#d4a853' }}>Construction OS 2.0</strong>
      </footer>
    </div>
  );
}

function KPI({ icon, label, value, color, sub }) {
  const colors = { red: 'text-red-400', green: 'text-emerald-400', blue: 'text-blue-400', gold: '', };
  return (
    <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#94a3b8' }}>{label}</span>
      </div>
      <p className={`text-xl font-bold ${colors[color]||''}`} style={color==='gold'?{color:'#d4a853'}:{}}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#64748b' }}>{sub}</p>}
    </div>
  );
}
