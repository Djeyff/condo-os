'use client';

export default function DelinquencyTable({ units, currency = 'DOP' }) {
  if (!units?.length) return <p className="text-gray-400 text-sm py-4">No data.</p>;

  const fmt = (n) => n?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) || '0';

  const statusColor = (status) => {
    if (!status) return 'badge-gray';
    if (status === 'Current') return 'badge-green';
    if (status.includes('1-30')) return 'badge-yellow';
    if (status.includes('31-60')) return 'badge-yellow';
    if (status.includes('61-90')) return 'badge-red';
    return 'badge-red';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Unit</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Owner</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
            <th className="text-right py-2 px-3 text-gray-500 font-medium">Balance</th>
            <th className="text-right py-2 px-3 text-gray-500 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-3 font-semibold">{u.unit}</td>
              <td className="py-2 px-3 text-gray-700">{u.owner}</td>
              <td className="py-2 px-3">
                <span className={`badge ${statusColor(u.status)}`}>{u.status || 'N/A'}</span>
              </td>
              <td className={`py-2 px-3 text-right font-mono ${u.balance < 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}`}>
                {u.balance < 0 ? '-' : ''}{fmt(Math.abs(u.balance))} {currency}
              </td>
              <td className="py-2 px-3 text-right text-gray-500">{u.share ? (u.share * 100).toFixed(1) + '%' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
