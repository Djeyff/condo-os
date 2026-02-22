'use client';
import { useState } from 'react';

export default function Header({ buildingName, unit, isAdmin, logo, primaryColor }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ background: 'linear-gradient(135deg, #0f1a2e, #1a2744)', borderColor: 'rgba(212,168,83,0.15)' }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          {logo ? (
            <img src={logo} alt="Logo" className="h-9 w-9 rounded-lg" />
          ) : (
            <div className="h-9 w-9 rounded-lg flex items-center justify-center text-base font-bold"
              style={{ background: 'linear-gradient(135deg, #d4a853, #c49a45)', color: '#0f1a2e' }}>
              🏢
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-white leading-tight">{buildingName}</h1>
            <p className="text-xs leading-tight" style={{ color: '#d4a853' }}>
              {isAdmin ? 'Administration' : unit ? `Unit ${unit}` : 'Portal'}
            </p>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {isAdmin && (
            <>
              <NavLink href="/admin" label="Dashboard" icon="📊" />
              <NavLink href="/admin/unit" label="Units" icon="🏠" />
            </>
          )}
          {unit && !isAdmin && (
            <>
              <NavLink href="/dashboard" label="Dashboard" icon="🏠" />
              <NavLink href="/statement" label="Statement" icon="📄" />
              <NavLink href="/maintenance" label="Maintenance" icon="🔧" />
            </>
          )}
          <a href="/api/auth?action=logout"
            className="ml-2 text-xs transition-colors px-3 py-1.5 rounded-lg"
            style={{ color: 'rgba(212,168,83,0.6)' }}
            onMouseOver={e => e.target.style.color = '#f87171'}
            onMouseOut={e => e.target.style.color = 'rgba(212,168,83,0.6)'}>
            Sign Out
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden p-2" style={{ color: '#d4a853' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <div className="sm:hidden px-4 py-3 space-y-1" style={{ borderTop: '1px solid rgba(212,168,83,0.1)', background: '#0f1a2e' }}>
          {isAdmin && (
            <>
              <MobileLink href="/admin" label="Dashboard" />
              <MobileLink href="/admin/unit" label="Units" />
            </>
          )}
          {unit && !isAdmin && (
            <>
              <MobileLink href="/dashboard" label="Dashboard" />
              <MobileLink href="/statement" label="Statement" />
              <MobileLink href="/maintenance" label="Maintenance" />
            </>
          )}
          <a href="/api/auth?action=logout" className="block px-3 py-2 text-sm text-red-400 rounded-lg">Sign Out</a>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, icon }) {
  return (
    <a href={href}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
      style={{ color: 'rgba(255,255,255,0.7)' }}
      onMouseOver={e => { e.currentTarget.style.color = '#d4a853'; e.currentTarget.style.background = 'rgba(212,168,83,0.1)'; }}
      onMouseOut={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'none'; }}>
      <span className="text-xs">{icon}</span> {label}
    </a>
  );
}

function MobileLink({ href, label }) {
  return (
    <a href={href} className="block px-3 py-2 text-sm font-medium rounded-lg" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</a>
  );
}
