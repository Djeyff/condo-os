'use client';

const links = [
  { href: '/construction', label: 'Dashboard', icon: '📊' },
  { href: '/construction/expenses', label: 'Expenses', icon: '💸' },
  { href: '/construction/timesheets', label: 'Timesheets', icon: '⏱️' },
  { href: '/construction/clients', label: 'Clients', icon: '🏢' },
  { href: '/construction/projects', label: 'Projects', icon: '🏗️' },
  { href: '/construction/maintenance', label: 'Maintenance', icon: '🔧' },
  { href: '/construction/calendar', label: 'Calendar', icon: '📅' },
];

export default function ConstructionNav() {
  return (
    <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #0f1a2e, #1a2744)', borderBottom: '1px solid rgba(212,168,83,0.15)' }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/construction" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center text-base font-bold"
            style={{ background: 'linear-gradient(135deg, #d4a853, #c49a45)', color: '#0f1a2e' }}>🏗️</div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Construction OS</h1>
            <p className="text-xs leading-tight" style={{ color: '#d4a853' }}>Management Dashboard</p>
          </div>
        </a>
        <nav className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <a key={l.href} href={l.href}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.7)' }}>
              <span className="text-xs">{l.icon}</span> {l.label}
            </a>
          ))}
          <a href="/admin" className="ml-2 text-xs px-3 py-1.5 rounded-lg" style={{ color: 'rgba(212,168,83,0.6)' }}>Condo →</a>
        </nav>
      </div>
    </header>
  );
}
