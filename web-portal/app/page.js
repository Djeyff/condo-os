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
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f1a2e 0%, #1a2744 40%, #243656 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-3xl mb-4"
            style={{ background: 'linear-gradient(135deg, #d4a853, #c49a45)', boxShadow: '0 8px 30px rgba(212,168,83,0.25)' }}>
            🏢
          </div>
          <h1 className="text-2xl font-bold text-white">{branding.name}</h1>
          <p className="mt-1" style={{ color: '#d4a853' }}>Owner Portal</p>
        </div>

        <LoginForm units={units} demoMode={demoMode} />

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(212,168,83,0.5)' }}>
          Powered by Condo Manager OS
        </p>
      </div>
    </div>
  );
}
