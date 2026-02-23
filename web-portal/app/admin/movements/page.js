import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getNumber, getSelect, getDate, getText } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import { DEMO_MODE, demoBranding, demoCashAccounts, demoMovements } from '@/lib/demoData';

export default async function MovementsPage({ searchParams }) {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');

  const fmt = (n) => {
    const abs = Math.abs(n || 0);
    const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + str;
  };

  const selectedAccount = searchParams?.account || null;
  const branding = DEMO_MODE ? demoBranding : getBranding();

  let accounts, movements;
  if (DEMO_MODE) {
    accounts = demoCashAccounts;
    movements = demoMovements;
  } else {
    // Fetch Cash Position accounts
    const cashDB = getDB('cashPosition');
    let cashPages = [];
    try { if (cashDB) cashPages = await queryDB(cashDB); } catch(e) {}
    accounts = cashPages.map(c => ({
      id: c.id,
      name: getTitle(c),
      balance: getNumber(c, 'Current Balance') || 0,
      type: getSelect(c, 'Account Type') || '',
    }));
    const accountMap = {};
    accounts.forEach(a => { accountMap[a.id] = a; });

    const movDB = getDB('movements');
    let movPages = [];
    try { if (movDB) movPages = await queryDB(movDB, undefined, [{ property: 'Date', direction: 'descending' }]); } catch(e) {}
    movements = movPages.map(p => {
      const accIds = p.properties?.Account?.relation?.map(r => r.id) || [];
      const acc = accIds[0] ? accountMap[accIds[0]] : null;
      return {
        date: getDate(p, 'Date'),
        description: getTitle(p),
        category: getSelect(p, 'Category'),
        type: getSelect(p, 'Movement'),
        amount: getNumber(p, 'Amount') || 0,
        balanceAfter: getNumber(p, 'Balance After') || 0,
        reference: getText(p, 'Reference'),
        accountName: acc?.name || 'Unknown',
        accountType: acc?.type || '',
      };
    });
  }

  // Filter by account
  const filtered = selectedAccount
    ? movements.filter(m => m.accountName === selectedAccount)
    : movements;

  // Summary per account
  const summary = accounts.map(a => {
    const acctMovements = movements.filter(m => m.accountName === a.name);
    const totalCredits = acctMovements.filter(m => m.type === 'Credit').reduce((s, m) => s + m.amount, 0);
    const totalDebits = acctMovements.filter(m => m.type === 'Debit').reduce((s, m) => s + m.amount, 0);
    return { ...a, totalCredits, totalDebits, count: acctMovements.length };
  });

  const GOLD = '#d4a853';

  return (
    <div className="min-h-screen" style={{ background: '#0a1628', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Header session={session} branding={branding} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a href="/admin" className="text-sm" style={{ color: GOLD }}>← Dashboard</a>
            </div>
            <h2 className="text-2xl font-bold text-white">💳 Account Movements</h2>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>
              {selectedAccount ? `Filtered: ${selectedAccount}` : `All accounts — ${filtered.length} entries`}
            </p>
          </div>
          {selectedAccount && (
            <a href="/admin/movements" className="px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
              Show All
            </a>
          )}
        </div>

        {/* Account Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {summary.map((acc, i) => (
            <a key={i} href={`/admin/movements?account=${encodeURIComponent(acc.name)}`}
              className="rounded-xl p-4 block transition-all hover:scale-[1.01]"
              style={{
                background: selectedAccount === acc.name ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selectedAccount === acc.name ? 'rgba(212,168,83,0.4)' : acc.balance < 0 ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>{acc.type}</p>
              <p className="text-sm font-semibold text-white mt-1">{acc.name}</p>
              <p className={`text-xl font-bold mt-2 font-mono ${acc.balance < 0 ? 'text-red-400' : 'text-white'}`}>
                {fmt(acc.balance)} <span className="text-xs font-normal" style={{ color: '#64748b' }}>DOP</span>
              </p>
              <div className="flex gap-4 mt-2">
                <p className="text-xs" style={{ color: '#6ee7b7' }}>↑ {fmt(acc.totalCredits)}</p>
                <p className="text-xs" style={{ color: '#f87171' }}>↓ {fmt(acc.totalDebits)}</p>
                <p className="text-xs" style={{ color: '#64748b' }}>{acc.count} entries</p>
              </div>
            </a>
          ))}
        </div>

        {/* Movements Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold text-white">{filtered.length} movements{selectedAccount ? ` — ${selectedAccount}` : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Date', 'Description', 'Account', 'Category', 'Type', 'Amount', 'Balance After'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{m.date}</td>
                    <td className="px-4 py-3 text-white font-medium max-w-xs truncate">{m.description}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#d4a853' }}>{m.accountName}</td>
                    <td className="px-4 py-3">
                      {m.category && <span className="inline-flex px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>{m.category}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${m.type === 'Credit' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                        {m.type === 'Credit' ? '↑ Credit' : '↓ Debit'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${m.type === 'Credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.type === 'Credit' ? '+' : '-'}{fmt(m.amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: '#64748b' }}>
                      {m.balanceAfter ? fmt(m.balanceAfter) : '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#64748b' }}>No movements found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
