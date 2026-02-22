'use client';
import { useState } from 'react';

export default function MaintenanceForm({ unit, unitPageId }) {
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const inputStyle = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true); setError(''); setSuccess('');
    const res = await fetch('/api/maintenance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, location, priority, unit, unitPageId }),
    });
    const data = await res.json();
    if (data.ok) {
      setSuccess(`Request #${data.ticketNumber} submitted! Administration will contact you.`);
      setDescription(''); setLocation(''); setPriority('Medium');
    } else { setError(data.error || 'Failed to submit'); }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: '#94a3b8' }}>Description *</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..." className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:outline-none"
          style={inputStyle} rows={3} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#94a3b8' }}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Kitchen, Lobby"
            className="w-full rounded-lg px-3 py-2 focus:ring-2 focus:outline-none" style={inputStyle} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#94a3b8' }}>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-lg px-3 py-2 focus:outline-none" style={inputStyle}>
            <option value="Low" style={{ background: '#1a2744' }}>Low</option>
            <option value="Medium" style={{ background: '#1a2744' }}>Medium</option>
            <option value="High" style={{ background: '#1a2744' }}>High</option>
          </select>
        </div>
      </div>
      {success && <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(52,211,153,0.1)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.2)' }}>{success}</div>}
      {error && <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(248,113,113,0.1)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.2)' }}>{error}</div>}
      <button type="submit" disabled={loading} className="btn-gold disabled:opacity-50">
        {loading ? 'Submitting...' : '🔧 Submit Request'}
      </button>
    </form>
  );
}
