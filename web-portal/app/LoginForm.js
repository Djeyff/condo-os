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
    <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl">
      {demoMode && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(212,168,83,0.15)', color: '#f0d890', border: '1px solid rgba(212,168,83,0.25)' }}>
          <strong>🎯 Demo Mode</strong> — Select any unit, PIN is not required. Try Admin too!
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <button type="button" onClick={() => setIsAdmin(false)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isAdmin ? 'text-white shadow-lg' : 'text-gray-400 bg-white/5'}`}
          style={!isAdmin ? { background: 'linear-gradient(135deg, #d4a853, #c49a45)' , color: '#0f1a2e' } : {}}>
          Owner
        </button>
        <button type="button" onClick={() => setIsAdmin(true)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isAdmin ? 'text-white shadow-lg' : 'text-gray-400 bg-white/5'}`}
          style={isAdmin ? { background: 'linear-gradient(135deg, #d4a853, #c49a45)', color: '#0f1a2e' } : {}}>
          Admin
        </button>
      </div>

      {!isAdmin && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#94a3b8' }}>Unit</label>
          <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 focus:ring-2 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            required={!isAdmin}>
            <option value="" style={{ background: '#1a2744' }}>Select your unit...</option>
            {units.map(u => (
              <option key={u.unit} value={u.unit} style={{ background: '#1a2744' }}>{u.unit} — {u.owner}</option>
            ))}
          </select>
        </div>
      )}

      {!demoMode && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#94a3b8' }}>PIN</label>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)}
            placeholder={isAdmin ? 'Admin PIN' : 'Enter PIN'}
            className="w-full rounded-lg px-3 py-2.5 focus:ring-2 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            maxLength={6} />
        </div>
      )}

      {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}

      <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-50 text-center">
        {loading ? 'Signing in...' : demoMode ? 'Explore Demo →' : 'Sign In'}
      </button>
    </form>
  );
}
