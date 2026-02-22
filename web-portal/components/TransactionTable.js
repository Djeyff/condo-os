'use client';

export default function TransactionTable({ entries, currency = 'DOP', showUnit = false }) {
  if (!entries?.length) {
    return <p className="text-gray-400 text-sm py-4">No transactions found.</p>;
  }

  const fmt = (n) => {
    if (n === null || n === undefined) return '';
    return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
            {showUnit && <th className="text-left py-2 px-3 text-gray-500 font-medium">Unit</th>}
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Description</th>
            <th className="text-right py-2 px-3 text-gray-500 font-medium">Debit</th>
            <th className="text-right py-2 px-3 text-gray-500 font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-3 text-gray-600">{e.date || '—'}</td>
              {showUnit && <td className="py-2 px-3 font-medium">{e.unit || ''}</td>}
              <td className="py-2 px-3">
                <span className={`badge ${e.type?.includes('Payment') ? 'badge-green' : 'badge-blue'}`}>
                  {e.type || ''}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-700">{e.description || ''}</td>
              <td className="py-2 px-3 text-right text-red-600 font-mono">
                {e.debit ? fmt(e.debit) : ''}
              </td>
              <td className="py-2 px-3 text-right text-emerald-600 font-mono">
                {e.credit ? fmt(e.credit) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
