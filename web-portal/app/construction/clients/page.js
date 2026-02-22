import { getConstructionDB } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber, getSelect, getDate } from '@/lib/notion';
import ConstructionNav from '@/components/ConstructionNav';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const fmt = (n) => { const a=Math.abs(n||0); return (n<0?'-':'')+a.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}); };

  let clients=[], expenses=[], timesheets=[];
  try { const db=getConstructionDB('clients'); if(db) clients=await queryDB(db); } catch(e){}
  try { const db=getConstructionDB('expenses'); if(db) expenses=await queryDB(db,{property:'Status',select:{equals:'Pending Reimbursement'}}); } catch(e){}
  try { const db=getConstructionDB('timesheets'); if(db) timesheets=await queryDB(db,{property:'Status',select:{equals:'Pending Reimbursement'}}); } catch(e){}

  const pendingExp = expenses.map(e=>({ desc:getTitle(e), amount:getNumber(e,'Amount')||0, date:getDate(e,'Date'), cat:getSelect(e,'Category') }));
  const pendingTs = timesheets.map(t=>({ task:getTitle(t), amount:getNumber(t,'Fixed Amount')||0, date:getDate(t,'Date'), hours:getNumber(t,'Hours')||0 }));

  const totalPendingExp = pendingExp.reduce((s,e)=>s+e.amount,0);
  const totalPendingTs = pendingTs.reduce((s,t)=>s+t.amount,0);

  const clientData = clients.map(c => ({
    name: getTitle(c), phone: getText(c,'Phone')||'', email: getText(c,'Email')||'',
    priority: getSelect(c,'Priority')||'', billing: getSelect(c,'Billing Terms')||'',
  }));

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <ConstructionNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Clients</h2>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-xs font-medium uppercase" style={{ color: '#94a3b8' }}>Total Clients</span>
            <p className="text-2xl font-bold" style={{ color: '#d4a853' }}>{clientData.length}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <span className="text-xs font-medium uppercase text-red-400">Pending Expenses</span>
            <p className="text-2xl font-bold text-red-400">{fmt(totalPendingExp)} <span className="text-sm" style={{ color: '#64748b' }}>DOP</span></p>
            <p className="text-xs" style={{ color: '#64748b' }}>{pendingExp.length} items</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <span className="text-xs font-medium uppercase text-red-400">Pending Timesheets</span>
            <p className="text-2xl font-bold text-red-400">{fmt(totalPendingTs)} <span className="text-sm" style={{ color: '#64748b' }}>DOP</span></p>
            <p className="text-xs" style={{ color: '#64748b' }}>{pendingTs.length} items</p>
          </div>
        </div>

        {/* Client Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {clientData.map((c,i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-base font-bold text-white mb-2">{c.name}</h3>
              <div className="space-y-1 text-sm">
                {c.phone && <p style={{ color: '#94a3b8' }}>📞 {c.phone}</p>}
                {c.email && <p style={{ color: '#94a3b8' }}>✉️ {c.email}</p>}
                {c.billing && <p style={{ color: '#64748b' }}>💳 {c.billing}</p>}
              </div>
              {c.priority && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-3 ${c.priority==='High'?'bg-red-100 text-red-800':c.priority==='Medium'?'bg-yellow-100 text-yellow-800':'bg-blue-100 text-blue-800'}`}>{c.priority}</span>}
            </div>
          ))}
        </div>

        {/* Pending Reimbursements Detail */}
        {(pendingExp.length>0 || pendingTs.length>0) && (
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(248,113,113,0.03)', border: '1px solid rgba(248,113,113,0.12)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(248,113,113,0.1)' }}>
              <h3 className="text-lg font-semibold text-red-400">Pending Reimbursements — {fmt(totalPendingExp+totalPendingTs)} DOP</h3>
            </div>
            <div>
              {pendingExp.map((e,i)=>(
                <div key={'e'+i} className="px-6 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div><p className="text-sm text-white">{e.desc}</p><p className="text-xs" style={{ color: '#64748b' }}>{e.date} · {e.cat} · Expense</p></div>
                  <span className="text-sm font-mono font-semibold text-red-400">{fmt(e.amount)}</span>
                </div>
              ))}
              {pendingTs.map((t,i)=>(
                <div key={'t'+i} className="px-6 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div><p className="text-sm text-white">{t.task}</p><p className="text-xs" style={{ color: '#64748b' }}>{t.date} · {t.hours}h · Timesheet</p></div>
                  <span className="text-sm font-mono font-semibold text-red-400">{fmt(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
