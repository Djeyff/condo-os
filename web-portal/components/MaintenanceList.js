'use client';

export default function MaintenanceList({ requests }) {
  if (!requests?.length) return <p className="text-gray-400 text-sm py-4">No maintenance requests.</p>;

  const statusBadge = (status) => {
    const map = {
      'Open': 'badge-red',
      'In Progress': 'badge-yellow',
      'Resolved': 'badge-green',
      'Closed': 'badge-gray',
    };
    return map[status] || 'badge-gray';
  };

  const priorityBadge = (p) => {
    const map = { 'High': 'badge-red', 'Medium': 'badge-yellow', 'Low': 'badge-blue' };
    return map[p] || 'badge-gray';
  };

  return (
    <div className="space-y-3">
      {requests.map((r, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{r.request}</h4>
              <p className="text-sm text-gray-500 mt-1">{r.location || 'No location specified'}</p>
              {r.assignedTo && <p className="text-xs text-gray-400 mt-1">Assigned: {r.assignedTo}</p>}
            </div>
            <div className="flex gap-2 ml-4">
              <span className={`badge ${priorityBadge(r.priority)}`}>{r.priority || 'N/A'}</span>
              <span className={`badge ${statusBadge(r.status)}`}>{r.status || 'Open'}</span>
            </div>
          </div>
          {r.date && <p className="text-xs text-gray-400 mt-2">{r.date}</p>}
        </div>
      ))}
    </div>
  );
}
