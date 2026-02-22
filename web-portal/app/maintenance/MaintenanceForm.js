'use client';
import { useState } from 'react';

export default function MaintenanceForm({ unit, unitPageId }) {
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, location, priority, unit, unitPageId }),
    });

    const data = await res.json();
    if (data.ok) {
      setSuccess(`Request #${data.ticketNumber} submitted! Administration will contact you based on urgency and contractor availability.`);
      setDescription('');
      setLocation('');
      setPriority('Medium');
    } else {
      setError(data.error || 'Failed to submit');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500"
          rows={3} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., Kitchen, Lobby"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>

      {success && <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg text-sm">{success}</div>}
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
        {loading ? 'Submitting...' : '🔧 Submit Request'}
      </button>
    </form>
  );
}
