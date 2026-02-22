import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getText, getSelect, getDate } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import MaintenanceList from '@/components/MaintenanceList';
import MaintenanceForm from './MaintenanceForm';

export default async function MaintenancePage() {
  const session = await getSession();
  if (!session.unit) redirect('/');
  const branding = getBranding();

  // Fetch maintenance requests for this unit
  let requests = [];
  const maintDB = getDB('maintenance');
  if (maintDB && session.unitPageId) {
    const raw = await queryDB(maintDB,
      { property: 'Unit', relation: { contains: session.unitPageId } },
      [{ property: 'Reported Date', direction: 'descending' }]
    );
    requests = raw.map(r => ({
      request: getTitle(r),
      status: getSelect(r, 'Status'),
      priority: getSelect(r, 'Priority'),
      location: getText(r, 'Location'),
      assignedTo: getText(r, 'Assigned To'),
      notes: getText(r, 'Notes'),
      date: getDate(r, 'Reported Date'),
    }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header buildingName={branding.name} unit={session.unit} logo={branding.logo}
        primaryColor={branding.primaryColor} />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Maintenance Requests</h2>

        {/* New Request Form */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit New Request</h3>
          <MaintenanceForm unit={session.unit} unitPageId={session.unitPageId} />
        </div>

        {/* Existing Requests */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Requests ({requests.length})
          </h3>
          <MaintenanceList requests={requests} />
        </div>
      </main>
    </div>
  );
}
