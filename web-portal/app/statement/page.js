import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber, getSelect, getDate } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import PrintButton from '@/components/PrintButton';
import TransactionTable from '@/components/TransactionTable';

export default async function StatementPage({ searchParams }) {
  const session = await getSession();
  if (!session.unit) redirect('/');
  const branding = getBranding();
  const unitPageId = session.unitPageId;

  // Fetch unit info
  let unitInfo = { unit: session.unit, owner: '', balance: 0, share: 0 };
  const unitsDB = getDB('units');
  if (unitsDB && unitPageId) {
    const units = await queryDB(unitsDB);
    const u = units.find(p => p.id === unitPageId);
    if (u) {
      unitInfo = {
        unit: getTitle(u),
        owner: getText(u, 'Owner Name'),
        balance: getNumber(u, 'Current Balance') || 0,
        share: getNumber(u, 'Ownership Share (%)') || 0,
      };
    }
  }

  // Fetch all ledger entries
  const ledgerDB = getDB('ledger');
  let entries = [];
  if (ledgerDB && unitPageId) {
    const raw = await queryDB(ledgerDB,
      { property: 'Unit', relation: { contains: unitPageId } },
      [{ property: 'Date', direction: 'ascending' }]
    );
    let running = 0;
    entries = raw.map(e => {
      const debit = getNumber(e, 'Debit') || 0;
      const credit = getNumber(e, 'Credit') || 0;
      running = running - debit + credit;
      return {
        date: getDate(e, 'Date'),
        type: getSelect(e, 'Type'),
        description: getTitle(e),
        debit: debit || null,
        credit: credit || null,
        balance: running,
      };
    });
  }

  const fmt = (n) => {
    const abs = Math.abs(n);
    const str = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + str;
  };

  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header buildingName={branding.name} unit={session.unit} logo={branding.logo}
        primaryColor={branding.primaryColor} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Account Statement</h2>
          <PrintButton />
        </div>

        {/* Statement Header */}
        <div className="card mb-6 print:shadow-none print:border-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Building</p>
              <p className="font-semibold">{branding.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Generated</p>
              <p className="font-semibold">{new Date().toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Unit</p>
              <p className="font-semibold">{unitInfo.unit}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Owner</p>
              <p className="font-semibold">{unitInfo.owner}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Ownership Share</p>
              <p className="font-semibold">{(unitInfo.share * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Balance</p>
              <p className={`font-bold text-lg ${unitInfo.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt(unitInfo.balance)} {branding.currency}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Transactions ({entries.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Description</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Debit</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Credit</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600">{e.date || '—'}</td>
                    <td className="py-2 px-3">
                      <span className={`badge ${e.type?.includes('Payment') ? 'badge-green' : 'badge-blue'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-700">{e.description}</td>
                    <td className="py-2 px-3 text-right text-red-600 font-mono">{e.debit ? fmt(e.debit) : ''}</td>
                    <td className="py-2 px-3 text-right text-emerald-600 font-mono">{e.credit ? fmt(e.credit) : ''}</td>
                    <td className={`py-2 px-3 text-right font-mono font-medium ${e.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {fmt(e.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-semibold">
                  <td colSpan={3} className="py-2 px-3 text-right">Totals</td>
                  <td className="py-2 px-3 text-right text-red-600 font-mono">{fmt(totalDebit)}</td>
                  <td className="py-2 px-3 text-right text-emerald-600 font-mono">{fmt(totalCredit)}</td>
                  <td className={`py-2 px-3 text-right font-mono ${unitInfo.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmt(unitInfo.balance)} {branding.currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
