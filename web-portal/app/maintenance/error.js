'use client';

export default function AdminError({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1a2e' }}>
      <div className="text-center p-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '500px' }}>
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>{error?.message || 'Server error loading admin dashboard.'}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#d4a853', color: '#0f1a2e' }}>
            Try Again
          </button>
          <a href="/" className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
