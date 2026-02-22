import { getBranding, getDB, getConfig } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber } from '@/lib/notion';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const session = await getSession();
  if (session.unit || session.isAdmin) redirect('/dashboard');

  const branding = getBranding();
  const config = getConfig();
  const demoMode = !config.portal?.pins || Object.keys(config.portal.pins).length === 0;
  const unitsDB = getDB('units');
  let units = [];

  if (unitsDB) {
    const pages = await queryDB(unitsDB, undefined, [{ property: 'Unit', direction: 'ascending' }]);
    units = pages.map(p => ({
      id: p.id,
      unit: getTitle(p),
      owner: getText(p, 'Owner Name'),
    }));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white text-3xl mb-4"
            style={{ backgroundColor: branding.primaryColor }}>
            🏢
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{branding.name}</h1>
          <p className="text-gray-500 mt-1">Owner Portal</p>
        </div>

        <LoginForm units={units} demoMode={demoMode} />

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Condo Manager OS
        </p>
      </div>
    </div>
  );
}
