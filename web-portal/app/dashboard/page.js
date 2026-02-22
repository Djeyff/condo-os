import { getSession } from '@/lib/auth';
import { getBranding, getDB } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber, getSelect, getDate } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import KPICard from '@/components/KPICard';
import TransactionTable from '@/components/TransactionTable';
import MaintenanceList from '@/components/MaintenanceList';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.unit && !session.isAdmin) redirect('/');

  const branding = getBranding();
  const unitPageId = session.unitPageId;

  // Fetch unit info
  let unitInfo = { unit: session.unit, owner: '', balance: 0, share: 0, status: '' };
  if (unitPageId) {
    const unitsDB = getDB('units');
    if (unitsDB) {
      const units = await queryDB(unitsDB);
      const u = units.find(p => p.id === unitPageId);
      if (u) {
        unitInfo = {
          unit: getTitle(u),
          owner: getText(u, 'Owner Name'),
          balance: getNumber(u, 'Current Balance') || 0,
          share: getNumber(u, 'Ownership Share (%)') || 0,
          status: getSelect(u, 'Fee Status') || 'Unknown',
        };
      }
    }
  }

  // Fetch recent ledger entries
  let recentEntries = [];
  const ledgerDB = getDB('ledger');
  if (ledgerDB && unitPageId) {
    const entries = await queryDB(ledgerDB,
      { property: 'Unit', relation: { contains: unitPageId } },
      [{ property: 'Date', direction: 'descending' }]
    );
    recentEntries = entries.slice(0, 8).map(e => ({
      date: getDate(e, 'Date'),
      type: getSelect(e, 'Type'),
      description: getTitle(e),
      debit: getNumber(e, 'Debit'),
      credit: getNumber(e, 'Credit'),
    }));
  }

  // Fetch maintenance requests
  let maintenanceReqs = [];
  const maintDB = getDB('maintenance');
  if (maintDB && unitPageId) {
    const reqs = await queryDB(maintDB,
      { property: 'Unit', relation: { contains: unitPageId } },
      [{ property: 'Reported Date', direction: 'descending' }]
    );
    maintenanceReqs = reqs.slice(0, 5).map(r => ({
      request: getTitle(r),
      status: getSelect(r, 'Status'),
      priority: getSelect(r, 'Priority'),
      location: getText(r, 'Location'),
      assignedTo: getText(r, 'Assigned To'),
      date: getDate(r, 'Reported Date'),
    }));
  }

  // Fetch next meeting
  let nextMeeting = null;
  const meetingsDB = getDB('meetings');
  if (meetingsDB) {
    const now = new Date().toISOString().slice(0, 10);
    const meetings = await queryDB(meetingsDB,
      { property: 'Date', date: { on_or_after: now } },
      [{ property: 'Date', direction: 'ascending' }]
    );
    if (meetings.length) {
      const m = meetings[0];
      nextMeeting = { title: getTitle(m), date: getDate(m, 'Date') };
    }
  }

  const fmt = (n) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header buildingName={branding.name} unit={session.unit} isAdmin={session.isAdmin}
        logo={branding.logo} primaryColor={branding.primaryColor} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Welcome, {unitInfo.owner || session.unit}
        </h2>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard title="Balance" icon="💰"
            value={`${unitInfo.balance < 0 ? '-' : ''}${fmt(unitInfo.balance)} ${branding.currency}`}
            color={unitInfo.balance >= 0 ? 'green' : 'red'}
            subtitle={unitInfo.status} />
          <KPICard title="Ownership Share" icon="📊"
            value={`${(unitInfo.share * 100).toFixed(1)}%`}
            color="blue" />
          <KPICard title="Open Requests" icon="🔧"
            value={maintenanceReqs.filter(r => r.status !== 'Resolved' && r.status !== 'Closed').length}
            color="yellow" />
          <KPICard title="Next Meeting" icon="📅"
            value={nextMeeting ? nextMeeting.date : 'None scheduled'}
            color="purple"
            subtitle={nextMeeting?.title || ''} />
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-8">
          <a href="/maintenance" className="btn-primary">🔧 New Request</a>
          <a href="/statement" className="btn-secondary">📊 Full Statement</a>
        </div>

        {/* Recent Transactions */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <TransactionTable entries={recentEntries} currency={branding.currency} />
        </div>

        {/* Maintenance */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Requests</h3>
          <MaintenanceList requests={maintenanceReqs} />
        </div>
      </main>
    </div>
  );
}
