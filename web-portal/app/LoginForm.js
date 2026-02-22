'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm({ units, demoMode }) {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const body = isAdmin
      ? { admin: true, pin }
      : { unit: selectedUnit, pin, unitPageId: units.find(u => u.unit === selectedUnit)?.id || '' };

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.ok) {
      router.push(isAdmin ? '/admin' : '/dashboard');
      router.refresh();
    } else {
      setError(data.error || 'Invalid credentials');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {demoMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <strong>🎯 Demo Mode</strong> — Select any unit, PIN is not required. Try Admin too!
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <button type="button" onClick={() => setIsAdmin(false)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Owner
        </button>
        <button type="button" onClick={() => setIsAdmin(true)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Admin
        </button>
      </div>

      {!isAdmin && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required={!isAdmin}>
            <option value="">Select your unit...</option>
            {units.map(u => (
              <option key={u.unit} value={u.unit}>{u.unit} — {u.owner}</option>
            ))}
          </select>
        </div>
      )}

      {!demoMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)}
            placeholder={isAdmin ? 'Admin PIN' : 'Enter PIN'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={6} />
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
        {loading ? 'Signing in...' : demoMode ? 'Explore Demo →' : 'Sign In'}
      </button>
    </form>
  );
}
