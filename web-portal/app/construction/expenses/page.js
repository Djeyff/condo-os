import { getConstructionDB } from '@/lib/config';
import { queryDB, getTitle, getNumber, getSelect, getDate } from '@/lib/notion';
import ConstructionNav from '@/components/ConstructionNav';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage() {
  const fmt = (n) => { const a=Math.abs(n||0); return (n<0?'-':'')+a.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}); };

  let expenses = [];
  try { const db=getConstructionDB('expenses'); if(db) expenses=await queryDB(db,undefined,[{property:'Date',direction:'descending'}]); } catch(e){}

  const data = expenses.map(e => ({
    desc: getTitle(e), amount: getNumber(e,'Amount')||0, date: getDate(e,'Date'),
    status: getSelect(e,'Status'), category: getSelect(e,'Category'), paidFrom: getSelect(e,'Paid From'),
  }));

  const total = data.reduce((s,e)=>s+e.amount,0);
  const pendingReimb = data.filter(e=>e.status==='Pending Reimbursement');
  const totalPending = pendingReimb.reduce((s,e)=>s+e.amount,0);

  const statusColor = (s) => {
    if(s==='Pending Reimbursement') return 'bg-red-100 text-red-700';
    if(s==='Reimbursed') return 'bg-emerald-100 text-emerald-800';
    if(s==='Paid') return 'bg-blue-100 text-blue-800';
    if(s==='Para Contador') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <ConstructionNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">All Expenses</h2>
          <div className="flex gap-3">
            <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>Total</span>
              <p className="text-lg font-bold text-white">{fmt(total)} <span className="text-xs" style={{ color: '#64748b' }}>DOP</span></p>
            </div>
            <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
              <span className="text-xs text-red-400">Pending Reimbursement</span>
              <p className="text-lg font-bold text-red-400">{fmt(totalPending)} <span className="text-xs" style={{ color: '#64748b' }}>DOP</span></p>
            </div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Description</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Category</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Paid From</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e,i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-2.5 px-4" style={{ color: '#94a3b8' }}>{e.date||'—'}</td>
                    <td className="py-2.5 px-4 text-white font-medium">{e.desc}</td>
                    <td className="py-2.5 px-4"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853' }}>{e.category}</span></td>
                    <td className="py-2.5 px-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(e.status)}`}>{e.status}</span></td>
                    <td className="py-2.5 px-4" style={{ color: '#94a3b8' }}>{e.paidFrom||'—'}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-white">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
