import { getSession } from '@/lib/auth';
import { getBranding, getDB, getConfig } from '@/lib/config';
import { queryDB, getTitle, getText, getNumber, getSelect, getDate } from '@/lib/notion';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import KPICard from '@/components/KPICard';
import DelinquencyTable from '@/components/DelinquencyTable';
import TransactionTable from '@/components/TransactionTable';
import MaintenanceList from '@/components/MaintenanceList';

export default async function AdminPage() {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');

  const branding = getBranding();
  const config = getConfig();

  // Fetch all units
  const unitsDB = getDB('units');
  const unitPages = unitsDB ? await queryDB(unitsDB) : [];
  const units = unitPages.map(u => ({
    unit: getTitle(u),
    owner: getText(u, 'Owner Name'),
    balance: getNumber(u, 'Current Balance') || 0,
    share: getNumber(u, 'Ownership Share (%)') || 0,
    status: getSelect(u, 'Fee Status') || 'Unknown',
  }));

  const totalOutstanding = units.reduce((s, u) => s + Math.min(0, u.balance), 0);
  const totalCollected = units.reduce((s, u) => s + Math.max(0, u.balance), 0);
  const delinquentCount = units.filter(u => u.balance < 0).length;

  // Fetch cash position
  const cashDB = getDB('cashPosition');
  const cashPages = cashDB ? await queryDB(cashDB) : [];
  const totalCash = cashPages.reduce((s, c) => s + (getNumber(c, 'Balance') || 0), 0);

  // Recent payments (last 10 ledger entries)
  const ledgerDB = getDB('ledger');
  let recentPayments = [];
  if (ledgerDB) {
    const entries = await queryDB(ledgerDB, undefined, [{ property: 'Date', direction: 'descending' }]);
    recentPayments = entries.slice(0, 10).map(e => ({
      date: getDate(e, 'Date'),
      type: getSelect(e, 'Type'),
      description: getTitle(e),
      debit: getNumber(e, 'Debit'),
      credit: getNumber(e, 'Credit'),
    }));
  }

  // Open maintenance requests
  const maintDB = getDB('maintenance');
  let openRequests = [];
  if (maintDB) {
    const reqs = await queryDB(maintDB,
      { or: [
        { property: 'Status', select: { equals: 'Open' } },
        { property: 'Status', select: { equals: 'In Progress' } },
      ]},
      [{ property: 'Reported Date', direction: 'descending' }]
    );
    openRequests = reqs.map(r => ({
      request: getTitle(r),
      status: getSelect(r, 'Status'),
      priority: getSelect(r, 'Priority'),
      location: getText(r, 'Location'),
      assignedTo: getText(r, 'Assigned To'),
      date: getDate(r, 'Reported Date'),
    }));
  }

  const fmt = (n) => {
    const abs = Math.abs(n);
    const str = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + str;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header buildingName={branding.name} isAdmin={true} logo={branding.logo}
        primaryColor={branding.primaryColor} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Admin Dashboard</h2>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard title="Total Outstanding" icon="⚠️"
            value={`${fmt(totalOutstanding)} ${branding.currency}`}
            color="red" subtitle={`${delinquentCount} delinquent units`} />
          <KPICard title="Total Cash" icon="🏦"
            value={`${fmt(totalCash)} ${branding.currency}`}
            color={totalCash > 0 ? 'green' : 'red'} />
          <KPICard title="Units" icon="🏠"
            value={units.length}
            color="blue" subtitle={`${units.filter(u => u.balance >= 0).length} current`} />
          <KPICard title="Open Requests" icon="🔧"
            value={openRequests.length}
            color={openRequests.length > 0 ? 'yellow' : 'green'} />
        </div>

        {/* Delinquency Table */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Units</h3>
          <DelinquencyTable units={units} currency={branding.currency} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
            <TransactionTable entries={recentPayments} currency={branding.currency} />
          </div>

          {/* Open Maintenance */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Open Maintenance</h3>
            <MaintenanceList requests={openRequests} />
          </div>
        </div>
      </main>
    </div>
  );
}
