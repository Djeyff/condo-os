'use client';
import { useState } from 'react';

export default function Header({ buildingName, unit, isAdmin, logo, primaryColor }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          {logo ? (
            <img src={logo} alt="Logo" className="h-9 w-9 rounded-lg" />
          ) : (
            <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-base font-bold shadow-sm"
              style={{ backgroundColor: primaryColor || '#2563eb' }}>
              🏢
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">{buildingName}</h1>
            <p className="text-xs text-gray-400 leading-tight">
              {isAdmin ? 'Administration' : unit ? `Unit ${unit}` : 'Portal'}
            </p>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {isAdmin && (
            <>
              <NavLink href="/admin" label="Dashboard" icon="📊" />
              <NavLink href="/dashboard" label="Units" icon="🏠" />
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
            className="ml-2 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
            Sign Out
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden text-gray-500 hover:text-gray-900 p-2">
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
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {isAdmin && (
            <>
              <MobileLink href="/admin" label="Dashboard" />
              <MobileLink href="/dashboard" label="Units" />
            </>
          )}
          {unit && !isAdmin && (
            <>
              <MobileLink href="/dashboard" label="Dashboard" />
              <MobileLink href="/statement" label="Statement" />
              <MobileLink href="/maintenance" label="Maintenance" />
            </>
          )}
          <a href="/api/auth?action=logout" className="block px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">Sign Out</a>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, icon }) {
  return (
    <a href={href}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
      <span className="text-xs">{icon}</span> {label}
    </a>
  );
}

function MobileLink({ href, label }) {
  return (
    <a href={href} className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">{label}</a>
  );
}
