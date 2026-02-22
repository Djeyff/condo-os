import { getConstructionDB } from '@/lib/config';
import { queryDB, getTitle, getNumber, getSelect, getDate, getCheckbox } from '@/lib/notion';
import ConstructionNav from '@/components/ConstructionNav';

export const dynamic = 'force-dynamic';

export default async function TimesheetsPage() {
  const fmt = (n) => { const a=Math.abs(n||0); return (n<0?'-':'')+a.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}); };

  let timesheets = [];
  try { const db=getConstructionDB('timesheets'); if(db) timesheets=await queryDB(db,undefined,[{property:'Date',direction:'descending'}]); } catch(e){}

  const data = timesheets.map(t => ({
    task: getTitle(t), hours: getNumber(t,'Hours')||0, date: getDate(t,'Date'),
    status: getSelect(t,'Status'), empPay: getSelect(t,'Employee payment status'),
    amount: getNumber(t,'Fixed Amount')||0, approved: getCheckbox(t,'Approved'),
  }));

  const totalHours = data.reduce((s,t)=>s+t.hours,0);
  const totalAmount = data.reduce((s,t)=>s+t.amount,0);
  const unpaid = data.filter(t=>t.empPay==='Not Paid');
  const totalUnpaid = unpaid.reduce((s,t)=>s+t.amount,0);

  const payColor = (s) => {
    if(s==='Paid') return 'bg-emerald-100 text-emerald-800';
    if(s==='Not Paid') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #141f35 100%)' }}>
      <ConstructionNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Timesheets</h2>
          <div className="flex gap-3">
            <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>Total Hours</span>
              <p className="text-lg font-bold" style={{ color: '#d4a853' }}>{totalHours}h</p>
            </div>
            <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
              <span className="text-xs text-red-400">Unpaid Workers</span>
              <p className="text-lg font-bold text-red-400">{fmt(totalUnpaid)} DOP</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Task</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Hours</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Client Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Employee Pay</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase" style={{ color: '#64748b' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t,i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-2.5 px-4" style={{ color: '#94a3b8' }}>{t.date||'—'}</td>
                    <td className="py-2.5 px-4 text-white font-medium">{t.task}</td>
                    <td className="py-2.5 px-4 text-right font-mono" style={{ color: '#d4a853' }}>{t.hours}</td>
                    <td className="py-2.5 px-4"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{t.status}</span></td>
                    <td className="py-2.5 px-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${payColor(t.empPay)}`}>{t.empPay}</span></td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-white">{fmt(t.amount)}</td>
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
