'use client';

export default function Header({ buildingName, unit, isAdmin, logo, primaryColor }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="Logo" className="h-8 w-8 rounded" />
          ) : (
            <div className="h-8 w-8 rounded flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: primaryColor || '#2563eb' }}>
              🏢
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{buildingName}</h1>
            {unit && <p className="text-xs text-gray-500">Unit {unit}</p>}
          </div>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {unit && !isAdmin && (
            <>
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
              <a href="/statement" className="text-gray-600 hover:text-gray-900">Statement</a>
              <a href="/maintenance" className="text-gray-600 hover:text-gray-900">Maintenance</a>
            </>
          )}
          {isAdmin && (
            <>
              <a href="/admin" className="text-gray-600 hover:text-gray-900">Admin</a>
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
            </>
          )}
          <a href="/api/auth?action=logout" className="text-red-500 hover:text-red-700 text-xs">Logout</a>
        </nav>
      </div>
    </header>
  );
}
