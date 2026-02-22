#!/usr/bin/env node
// =============================================================================
// Condo Manager OS — Interactive Dashboard Generator
// =============================================================================
// Generates/refreshes rich Notion dashboard pages with live data from all DBs.
// Run on demand or via cron for always-up-to-date dashboards.
//
// Usage:
//   node refresh-dashboards.js              # Refresh all dashboards
//   node refresh-dashboards.js --page=financial  # Refresh specific page
//   node refresh-dashboards.js --setup      # Create dashboard pages (first time)
//
// Dashboards created:
//   📊 Financial Overview (cash, budget, income vs expense, trends)
//   🔴 Delinquency Tracker (per-unit aging, escalation, impact)
//   🔧 Maintenance Board (status breakdown, priority matrix, response times)
//   🏗️ Works & Projects (timeline, payment progress, upcoming votes)
//   📈 KPI Summary (key metrics across all areas)
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CONFIG_PATH = path.join(
  os.homedir(), '.openclaw', 'skills', 'condo-manager-os', 'config.json'
);

let config;
try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
catch (e) { console.error('✗ Cannot read config.json'); process.exit(1); }

const DB       = config.databases || {};
const BUILDING = config.building  || {};
const CURRENCY = BUILDING.currency || 'DOP';
const PARENT   = config.notion?.parentPageId || '';
const DASH     = config.dashboards || {};

// Bridge
const BRIDGE_CANDIDATES = [
  path.join(__dirname, '..', 'bridge.js'),
  path.join(os.homedir(), '.openclaw', 'workspace', 'app', 'skills', 'notion', 'bridge.js'),
];
let bridge;
for (const bp of BRIDGE_CANDIDATES) {
  if (fs.existsSync(bp)) { bridge = require(bp); break; }
}
if (!bridge) { console.error('✗ bridge.js not found'); process.exit(1); }

const { request } = bridge;
const RATE_MS = 350;
let _lastCall = 0;
async function api(fn) {
  const wait = RATE_MS - (Date.now() - _lastCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  const res = await fn();
  _lastCall = Date.now();
  return res;
}
async function queryAll(dbId, filter = null, sorts = null) {
  if (!dbId) return [];
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (cursor) body.start_cursor = cursor;
    const res = await api(() => request('/databases/' + dbId + '/query', 'POST', JSON.stringify(body)));
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return pages;
}

// ─── Property helpers ───────────────────────────────────────────────────────

function getTitle(p) {
  for (const v of Object.values(p.properties || {}))
    if (v.type === 'title') return (v.title || []).map(t => t.plain_text).join('');
  return '';
}
function getNum(p, k) {
  const v = p?.properties?.[k];
  if (!v) return null;
  if (v.type === 'number') return v.number;
  if (v.type === 'formula') return v.formula?.number;
  if (v.type === 'rollup') return v.rollup?.number;
  return null;
}
function getSel(p, k) {
  const v = p?.properties?.[k];
  return v?.type === 'select' && v.select ? v.select.name : '';
}
function getDate(p, k) {
  const v = p?.properties?.[k];
  return v?.type === 'date' && v.date ? v.date.start : null;
}
function getText(p, k) {
  const v = p?.properties?.[k];
  if (!v) return '';
  if (v.type === 'rich_text') return (v.rich_text || []).map(t => t.plain_text).join('');
  if (v.type === 'title') return (v.title || []).map(t => t.plain_text).join('');
  return '';
}
function getRels(p, k) {
  const v = p?.properties?.[k];
  return v?.type === 'relation' ? (v.relation || []).map(r => r.id) : [];
}

function fmt(n) {
  if (n == null) return '—';
  return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmtM(n) { return `${fmt(n)} ${CURRENCY}`; }
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d.length === 10 ? d + 'T12:00:00Z' : d);
  return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
}

// ─── Block builders ─────────────────────────────────────────────────────────

function heading1(text, color = 'default') {
  return { type: 'heading_1', heading_1: { rich_text: [{ text: { content: text } }], color } };
}
function heading2(text, color = 'default') {
  return { type: 'heading_2', heading_2: { rich_text: [{ text: { content: text } }], color } };
}
function heading3(text, color = 'default') {
  return { type: 'heading_3', heading_3: { rich_text: [{ text: { content: text } }], color } };
}
function paragraph(text, color = 'default') {
  return { type: 'paragraph', paragraph: { rich_text: [{ text: { content: text } }], color } };
}
function callout(emoji, text, color = 'default') {
  return { type: 'callout', callout: { icon: { emoji }, rich_text: [{ text: { content: text } }], color } };
}
function divider() { return { type: 'divider', divider: {} }; }
function columns(...cols) {
  // Notion requires at least 2 columns
  while (cols.length < 2) cols.push([paragraph('')]);
  return {
    type: 'column_list',
    column_list: {
      children: cols.map(blocks => ({
        type: 'column',
        column: { children: Array.isArray(blocks) ? blocks : [blocks] }
      }))
    }
  };
}
function toggle(title, children) {
  return {
    type: 'toggle',
    toggle: {
      rich_text: [{ text: { content: title } }],
      children: children,
    }
  };
}
function bulletItem(text) {
  return { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ text: { content: text } }] } };
}
function numberedItem(text) {
  return { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ text: { content: text } }] } };
}

/** Progress bar: ████████░░░░ 67% */
function progressBar(pct, width = 20) {
  const filled = Math.round(Math.min(1, Math.max(0, pct)) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(pct * 100)}%`;
}

/** Color based on value */
function balanceColor(n) {
  if (n > 0) return 'green_background';
  if (n >= -1000) return 'yellow_background';
  return 'red_background';
}

// ─── Data fetching ──────────────────────────────────────────────────────────

async function fetchAllData() {
  console.log('📊 Fetching data from all databases...');

  const [units, ledger, budget, expenses, maintenance, works, cash, movements, comms, meetings, resolutions] = await Promise.all([
    queryAll(DB.units),
    queryAll(DB.ledger, null, [{ property: 'Date', direction: 'descending' }]),
    queryAll(DB.budget),
    queryAll(DB.expenses, null, [{ property: 'Date', direction: 'descending' }]),
    queryAll(DB.maintenance),
    queryAll(DB.works),
    queryAll(DB.cashPosition),
    queryAll(DB.movements, null, [{ property: 'Date', direction: 'descending' }]),
    queryAll(DB.communications, null, [{ property: 'Date', direction: 'descending' }]),
    queryAll(DB.meetings, null, [{ property: 'Date', direction: 'descending' }]),
    queryAll(DB.resolutions),
  ]);

  console.log(`  Units: ${units.length}, Ledger: ${ledger.length}, Budget: ${budget.length}`);
  console.log(`  Expenses: ${expenses.length}, Maintenance: ${maintenance.length}, Works: ${works.length}`);
  console.log(`  Cash: ${cash.length}, Movements: ${movements.length}, Comms: ${comms.length}`);
  console.log(`  Meetings: ${meetings.length}, Resolutions: ${resolutions.length}`);

  return { units, ledger, budget, expenses, maintenance, works, cash, movements, comms, meetings, resolutions };
}

// ─── Dashboard: Financial Overview ──────────────────────────────────────────

function buildFinancialDashboard(data) {
  const { units, budget, expenses, cash, movements, ledger } = data;
  const now = new Date();
  const timestamp = `${now.toISOString().slice(0,16).replace('T',' ')} UTC`;

  // Cash position
  let totalCash = 0;
  const cashCards = [];
  for (const acc of cash) {
    const name = getTitle(acc);
    const bal = getNum(acc, 'Current Balance') || 0;
    totalCash += bal;
    const color = bal > 0 ? 'green_background' : bal < -1000 ? 'red_background' : 'yellow_background';
    const emoji = name.toLowerCase().includes('reserv') ? '🔒' : name.toLowerCase().includes('banco') ? '🏦' : '💵';
    cashCards.push(callout(emoji, `${name}\n${fmtM(bal)}`, color));
  }

  // Budget performance
  let totalBudget = 0, totalActual = 0;
  const budgetLines = [];
  for (const b of budget) {
    const cat = getTitle(b);
    const annual = getNum(b, 'Annual Budget') || 0;
    const actual = getNum(b, 'Annual Actual') || 0;
    totalBudget += annual;
    totalActual += actual;
    if (annual > 0) {
      const pct = actual / annual;
      const status = pct > 1.1 ? '🔴' : pct > 0.9 ? '🟡' : '🟢';
      budgetLines.push({ cat, annual, actual, pct, status });
    }
  }
  budgetLines.sort((a, b) => b.pct - a.pct);

  // Income (credits in ledger)
  const totalCredits = ledger.reduce((s, e) => s + (getNum(e, 'Credit') || 0), 0);
  const totalDebits = ledger.reduce((s, e) => s + (getNum(e, 'Debit') || 0), 0);

  // Collection rate
  const collectionRate = totalBudget > 0 ? totalCredits / totalBudget : 0;

  const blocks = [
    callout('📊', `FINANCIAL DASHBOARD — ${BUILDING.name || 'Building'}\nLast refreshed: ${timestamp}`, 'blue_background'),
    divider(),

    // KPI Row
    heading1('💰 Cash Position', 'blue'),
    columns(...cashCards.slice(0, 3)),
    callout(totalCash < 10000 ? '🚨' : '✅',
      `Total Available: ${fmtM(totalCash)}${totalCash < 10000 ? ' — CRITICAL LOW' : ''}`,
      totalCash < 10000 ? 'red_background' : 'green_background'),
    divider(),

    // Income vs Expense
    heading1('📈 Income vs Expenses', 'purple'),
    columns(
      [callout('⬇️', `Total Income\n${fmtM(totalCredits)}`, 'green_background')],
      [callout('⬆️', `Total Expenses\n${fmtM(totalActual)}`, 'orange_background')],
      [callout('📊', `Collection Rate\n${progressBar(collectionRate)}`, collectionRate > 0.8 ? 'green_background' : 'yellow_background')]
    ),
    divider(),

    // Budget Performance
    heading1('📋 Budget vs Actual', 'orange'),
    columns(
      [callout('📊', `Annual Budget\n${fmtM(totalBudget)}`, 'blue_background')],
      [callout('💸', `Total Spent\n${fmtM(totalActual)}`, totalActual > totalBudget ? 'red_background' : 'green_background')],
      [callout('📉', `Variance\n${fmtM(totalActual - totalBudget)} (${totalBudget > 0 ? Math.round((totalActual / totalBudget - 1) * 100) : 0}%)`,
        totalActual > totalBudget ? 'red_background' : 'green_background')]
    ),
  ];

  // Budget breakdown toggle
  const budgetItems = budgetLines.map(b =>
    bulletItem(`${b.status} ${b.cat}: ${fmtM(b.actual)} / ${fmtM(b.annual)} ${progressBar(b.pct, 15)}`)
  );
  if (budgetItems.length) {
    blocks.push(toggle('📋 Budget Breakdown by Category', budgetItems));
  }

  // Recent movements
  blocks.push(divider());
  blocks.push(heading1('💳 Recent Account Movements', 'green'));
  const recentMov = movements.slice(0, 8).map(m => {
    const desc = getTitle(m);
    const date = getDate(m, 'Date');
    const amount = getNum(m, 'Amount') || 0;
    const type = getSel(m, 'Movement');
    const emoji = type === 'Credit' || type === 'Ingreso' ? '🟢' : '🔴';
    return bulletItem(`${emoji} ${fmtDate(date)} — ${desc}: ${fmtM(amount)}`);
  });
  if (recentMov.length) {
    blocks.push(...recentMov);
  } else {
    blocks.push(paragraph('No recent movements.'));
  }

  return blocks;
}

// ─── Dashboard: Delinquency Tracker ─────────────────────────────────────────

function buildDelinquencyDashboard(data) {
  const { units, ledger } = data;
  const now = new Date();
  const timestamp = `${now.toISOString().slice(0,16).replace('T',' ')} UTC`;

  const unitData = [];
  let totalOwed = 0, totalPositive = 0, delinquentCount = 0;

  for (const u of units) {
    const name = getTitle(u);
    if (!name || name === '(template)') continue;
    const balance = getNum(u, 'Current Balance') ?? 0;
    const owner = getText(u, 'Owner Name');
    const status = getSel(u, 'Fee Status');
    const lastPay = getDate(u, 'Last Payment Date');
    const share = getNum(u, 'Ownership Share (%)') || 0;

    unitData.push({ name, balance, owner, status, lastPay, share, id: u.id });

    if (balance < 0) {
      totalOwed += Math.abs(balance);
      delinquentCount++;
    } else {
      totalPositive += balance;
    }
  }

  unitData.sort((a, b) => a.balance - b.balance);

  const blocks = [
    callout('🔴', `DELINQUENCY TRACKER — ${BUILDING.name || 'Building'}\nLast refreshed: ${timestamp}`, 'red_background'),
    divider(),

    // Summary KPIs
    heading1('📊 Overview', 'red'),
    columns(
      [callout('💀', `Total Outstanding\n${fmtM(-totalOwed)}`, 'red_background')],
      [callout('🏠', `Delinquent Units\n${delinquentCount} of ${unitData.length}`, delinquentCount > 0 ? 'yellow_background' : 'green_background')],
      [callout('📊', `Delinquency Rate\n${progressBar(delinquentCount / Math.max(1, unitData.length))}`,
        delinquentCount > unitData.length / 2 ? 'red_background' : 'yellow_background')]
    ),
    divider(),

    // Per-unit breakdown
    heading1('🏠 Unit-by-Unit Status', 'purple'),
  ];

  for (const u of unitData) {
    const emoji = u.balance >= 0 ? '✅' : u.balance > -5000 ? '🟡' : u.balance > -50000 ? '🟠' : '🔴';
    const pctOfTotal = totalOwed > 0 && u.balance < 0 ? ` (${Math.round(Math.abs(u.balance) / totalOwed * 100)}% of total debt)` : '';
    const ownerShort = u.owner.length > 30 ? u.owner.slice(0, 28) + '…' : u.owner;

    let detail = `${u.name} — ${ownerShort}\n`;
    detail += `Balance: ${fmtM(u.balance)}${pctOfTotal}\n`;
    detail += `Status: ${u.status || '—'}\n`;
    detail += `Last Payment: ${u.lastPay ? fmtDate(u.lastPay) : 'Never'}\n`;
    detail += `Ownership: ${(u.share * 100).toFixed(1)}%`;

    blocks.push(callout(emoji, detail, u.balance >= 0 ? 'green_background' : u.balance > -5000 ? 'yellow_background' : 'red_background'));
  }

  // Impact analysis
  blocks.push(divider());
  blocks.push(heading1('💡 Impact Analysis', 'blue'));

  const worstUnit = unitData[0];
  if (worstUnit && worstUnit.balance < 0) {
    const worstPct = Math.round(Math.abs(worstUnit.balance) / totalOwed * 100);
    blocks.push(callout('📊',
      `Worst offender: ${worstUnit.name} (${worstUnit.owner})\n` +
      `Owes: ${fmtM(Math.abs(worstUnit.balance))} = ${worstPct}% of all debt\n\n` +
      `If ${worstUnit.name} paid in full, available cash would increase by ${fmtM(Math.abs(worstUnit.balance))}`,
      'orange_background'));
  }

  return blocks;
}

// ─── Dashboard: Maintenance Board ───────────────────────────────────────────

function buildMaintenanceDashboard(data) {
  const { maintenance, units } = data;
  const now = new Date();
  const timestamp = `${now.toISOString().slice(0,16).replace('T',' ')} UTC`;

  // Status counts
  const statusCounts = {};
  const priorityCounts = {};
  let totalEstimated = 0, totalActual = 0, completed = 0;

  for (const m of maintenance) {
    const status = getSel(m, 'Status') || 'Unknown';
    const priority = getSel(m, 'Priority') || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    const est = getNum(m, 'Estimated Cost') || 0;
    const act = getNum(m, 'Actual Cost') || 0;
    totalEstimated += est;
    totalActual += act;
    if (status === 'Completed') completed++;
  }

  const completionRate = maintenance.length > 0 ? completed / maintenance.length : 0;

  const blocks = [
    callout('🔧', `MAINTENANCE BOARD — ${BUILDING.name || 'Building'}\nLast refreshed: ${timestamp}`, 'purple_background'),
    divider(),

    // KPIs
    heading1('📊 Summary', 'purple'),
    columns(
      [callout('📋', `Total Requests\n${maintenance.length}`, 'blue_background')],
      [callout('✅', `Completion Rate\n${progressBar(completionRate)}`, completionRate > 0.7 ? 'green_background' : 'yellow_background')],
      [callout('💰', `Total Cost\n${fmtM(totalActual)} / ${fmtM(totalEstimated)} est.`, 'orange_background')]
    ),
    divider(),

    // Status breakdown
    heading1('📊 By Status', 'green'),
  ];

  const statusEmojis = { 'New': '🆕', 'Assigned': '👷', 'In Progress': '🔨', 'Completed': '✅', 'Cancelled': '❌' };
  const statusColors = { 'New': 'blue_background', 'Assigned': 'yellow_background', 'In Progress': 'orange_background', 'Completed': 'green_background', 'Cancelled': 'gray_background' };

  const statusCards = Object.entries(statusCounts).map(([status, count]) =>
    callout(statusEmojis[status] || '📋', `${status}\n${count} request${count !== 1 ? 's' : ''}`, statusColors[status] || 'default')
  );
  if (statusCards.length >= 3) {
    blocks.push(columns(...statusCards.slice(0, 3)));
    if (statusCards.length > 3) blocks.push(columns(...statusCards.slice(3)));
  } else if (statusCards.length) {
    blocks.push(columns(...statusCards));
  }

  // Priority matrix
  blocks.push(divider());
  blocks.push(heading1('⚡ By Priority', 'red'));

  const prioEmojis = { 'Emergency 🔴': '🔴', 'High 🟠': '🟠', 'Medium 🟡': '🟡', 'Low 🟢': '🟢' };
  const prioColors = { 'Emergency 🔴': 'red_background', 'High 🟠': 'orange_background', 'Medium 🟡': 'yellow_background', 'Low 🟢': 'green_background' };

  const prioCards = Object.entries(priorityCounts).map(([prio, count]) =>
    callout(prioEmojis[prio] || '⚪', `${prio}\n${count}`, prioColors[prio] || 'default')
  );
  if (prioCards.length) blocks.push(columns(...prioCards));

  // Open items detail
  blocks.push(divider());
  blocks.push(heading1('📋 Open Items', 'orange'));

  const openItems = maintenance.filter(m => !['Completed', 'Cancelled'].includes(getSel(m, 'Status')));
  if (openItems.length) {
    for (const m of openItems) {
      const title = getTitle(m);
      const status = getSel(m, 'Status');
      const priority = getSel(m, 'Priority');
      const location = getText(m, 'Location');
      const reported = getDate(m, 'Reported Date');
      const assigned = getText(m, 'Assigned To');
      blocks.push(callout(
        prioEmojis[priority] || '📋',
        `${title}\nStatus: ${status} | Priority: ${priority}\nLocation: ${location} | Assigned: ${assigned || 'Unassigned'}\nReported: ${fmtDate(reported)}`,
        statusColors[status] || 'default'
      ));
    }
  } else {
    blocks.push(callout('✅', 'No open maintenance requests!', 'green_background'));
  }

  return blocks;
}

// ─── Dashboard: Works & Projects ────────────────────────────────────────────

function buildWorksDashboard(data) {
  const { works } = data;
  const now = new Date();
  const timestamp = `${now.toISOString().slice(0,16).replace('T',' ')} UTC`;

  let totalQuoted = 0, totalPaid = 0;
  const statusGroups = { 'Completed': [], 'In Progress': [], 'Proposed': [], 'Other': [] };

  for (const w of works) {
    const status = getSel(w, 'Status') || 'Other';
    const quoted = getNum(w, 'Quoted Amount') || 0;
    const paid = getNum(w, 'Total Paid') || 0;
    totalQuoted += quoted;
    totalPaid += paid;

    const group = statusGroups[status] || statusGroups['Other'];
    group.push(w);
  }

  const blocks = [
    callout('🏗️', `WORKS & PROJECTS — ${BUILDING.name || 'Building'}\nLast refreshed: ${timestamp}`, 'orange_background'),
    divider(),

    heading1('📊 Portfolio Overview', 'orange'),
    columns(
      [callout('📋', `Total Projects\n${works.length}`, 'blue_background')],
      [callout('💰', `Total Quoted\n${fmtM(totalQuoted)}`, 'orange_background')],
      [callout('💸', `Total Paid\n${fmtM(totalPaid)}\n${progressBar(totalQuoted > 0 ? totalPaid / totalQuoted : 0)}`, 'green_background')]
    ),
    divider(),
  ];

  // Per-project cards
  for (const [status, items] of Object.entries(statusGroups)) {
    if (!items.length) continue;
    const statusEmoji = { 'Completed': '✅', 'In Progress': '🔨', 'Proposed': '📋' }[status] || '📋';
    const statusColor = { 'Completed': 'green', 'In Progress': 'orange', 'Proposed': 'blue' }[status] || 'default';

    blocks.push(heading2(`${statusEmoji} ${status} (${items.length})`, statusColor));

    for (const w of items) {
      const title = getTitle(w);
      const quoted = getNum(w, 'Quoted Amount') || 0;
      const paid = getNum(w, 'Total Paid') || 0;
      const remaining = getNum(w, 'Remaining') || 0;
      const contractor = getText(w, 'Contractor');
      const start = getDate(w, 'Start Date');
      const end = getDate(w, 'Actual Completion') || getDate(w, 'Expected Completion');
      const voteResult = getText(w, 'Vote Result');

      let detail = `${title}\n`;
      detail += `Contractor: ${contractor || 'TBD'}\n`;
      detail += `Budget: ${fmtM(quoted)} | Paid: ${fmtM(paid)} | Remaining: ${fmtM(remaining)}\n`;
      detail += `${progressBar(quoted > 0 ? paid / quoted : 0, 20)}\n`;
      if (start) detail += `Timeline: ${fmtDate(start)} → ${end ? fmtDate(end) : 'Ongoing'}`;
      if (voteResult) detail += `\nVote: ${voteResult}`;

      const bgColor = status === 'Completed' ? 'green_background' : status === 'In Progress' ? 'yellow_background' : 'blue_background';
      blocks.push(callout(statusEmoji, detail, bgColor));
    }
  }

  return blocks;
}

// ─── Dashboard: KPI Summary (Main Hub) ─────────────────────────────────────

function buildKPIHub(data) {
  const { units, ledger, budget, expenses, maintenance, works, cash, movements, comms, meetings, resolutions } = data;
  const now = new Date();
  const timestamp = `${now.toISOString().slice(0,16).replace('T',' ')} UTC`;

  // Compute KPIs
  let totalCash = 0;
  for (const acc of cash) totalCash += getNum(acc, 'Current Balance') || 0;

  let totalOwed = 0, delinquentCount = 0, unitCount = 0;
  for (const u of units) {
    if (!getTitle(u) || getTitle(u) === '(template)') continue;
    unitCount++;
    const bal = getNum(u, 'Current Balance') ?? 0;
    if (bal < 0) { totalOwed += Math.abs(bal); delinquentCount++; }
  }

  let totalBudget = 0, totalActual = 0;
  for (const b of budget) {
    totalBudget += getNum(b, 'Annual Budget') || 0;
    totalActual += getNum(b, 'Annual Actual') || 0;
  }

  const openMaint = maintenance.filter(m => !['Completed', 'Cancelled'].includes(getSel(m, 'Status'))).length;
  const activeWorks = works.filter(w => getSel(w, 'Status') === 'In Progress').length;
  const totalResolutions = resolutions.length;
  const passedResolutions = resolutions.filter(r => {
    const p = r.properties['Passed'];
    return p?.type === 'formula' ? p.formula?.boolean : p?.checkbox;
  }).length;

  const blocks = [
    callout('📈', `KPI DASHBOARD — ${BUILDING.name || 'Building'}\nLast refreshed: ${timestamp}\n\n` +
      `${unitCount} units | ${CURRENCY} | ${BUILDING.feeFrequency || 'quarterly'} billing`, 'blue_background'),
    divider(),

    // Row 1: Financial
    heading1('💰 Financial Health', 'blue'),
    columns(
      [callout('🏦', `Cash Available\n${fmtM(totalCash)}`, totalCash > 10000 ? 'green_background' : 'red_background')],
      [callout('💀', `Outstanding Debt\n${fmtM(totalOwed)}`, totalOwed > 0 ? 'red_background' : 'green_background')],
      [callout('📊', `Budget Execution\n${progressBar(totalBudget > 0 ? totalActual / totalBudget : 0)}`,
        totalActual > totalBudget ? 'red_background' : 'green_background')]
    ),
    divider(),

    // Row 2: Operations
    heading1('🔧 Operations', 'purple'),
    columns(
      [callout('🔧', `Open Maintenance\n${openMaint} of ${maintenance.length}`, openMaint > 0 ? 'yellow_background' : 'green_background')],
      [callout('🏗️', `Active Works\n${activeWorks} of ${works.length}`, activeWorks > 0 ? 'orange_background' : 'green_background')],
      [callout('🏠', `Delinquent Units\n${delinquentCount} of ${unitCount}`, delinquentCount > 0 ? 'red_background' : 'green_background')]
    ),
    divider(),

    // Row 3: Governance
    heading1('🗳️ Governance', 'orange'),
    columns(
      [callout('📅', `Meetings Held\n${meetings.length}`, 'blue_background')],
      [callout('🗳️', `Resolutions\n${passedResolutions}/${totalResolutions} passed`, 'green_background')],
      [callout('📨', `Communications\n${comms.length} sent`, 'purple_background')]
    ),
    divider(),

    // Data density
    heading1('📊 System Stats', 'green'),
    callout('🗄️',
      `Database Records: ${units.length + ledger.length + budget.length + expenses.length + maintenance.length + works.length + cash.length + movements.length + comms.length + meetings.length + resolutions.length} total\n\n` +
      `🏠 Units: ${units.length} | 💰 Ledger: ${ledger.length} | 📋 Budget: ${budget.length}\n` +
      `💸 Expenses: ${expenses.length} | 🔧 Maintenance: ${maintenance.length} | 🏗️ Works: ${works.length}\n` +
      `🏦 Cash Accounts: ${cash.length} | 💳 Movements: ${movements.length}\n` +
      `📨 Communications: ${comms.length} | 📅 Meetings: ${meetings.length} | 🗳️ Resolutions: ${resolutions.length}`,
      'gray_background'),
  ];

  return blocks;
}

// ─── Page management ────────────────────────────────────────────────────────

async function clearPageContent(pageId) {
  // Delete all existing children blocks
  const children = await api(() => request(`/blocks/${pageId}/children?page_size=100`, 'GET'));
  for (const block of (children.results || [])) {
    await api(() => request(`/blocks/${block.id}`, 'DELETE'));
  }
}

async function setPageContent(pageId, blocks) {
  // Notion API limits children to 100 per append
  for (let i = 0; i < blocks.length; i += 100) {
    const chunk = blocks.slice(i, i + 100);
    await api(() => request(`/blocks/${pageId}/children`, 'PATCH', JSON.stringify({ children: chunk })));
  }
}

async function createDashboardPage(title, emoji, parentPageId) {
  const page = await api(() => request('/pages', 'POST', JSON.stringify({
    parent: { page_id: parentPageId },
    icon: { emoji },
    properties: { title: { title: [{ text: { content: title } }] } },
  })));
  return page.id;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isSetup = args.includes('--setup');
  const pageFilter = args.find(a => a.startsWith('--page='))?.split('=')[1];

  const parentPageId = PARENT || Object.values(DB)[0]; // fallback
  if (!parentPageId) {
    console.error('✗ No parent page ID configured. Set notion.parentPageId in config.json');
    process.exit(1);
  }

  // Dashboard page IDs (from config or to be created)
  let dashPages = DASH;

  if (isSetup) {
    console.log('🔧 Creating dashboard pages...');

    if (!dashPages.kpi) {
      dashPages.kpi = await createDashboardPage('📈 KPI Dashboard', '📈', parentPageId);
      console.log(`  ✅ KPI Dashboard: ${dashPages.kpi}`);
    }
    if (!dashPages.financial) {
      dashPages.financial = await createDashboardPage('📊 Financial Dashboard', '📊', parentPageId);
      console.log(`  ✅ Financial Dashboard: ${dashPages.financial}`);
    }
    if (!dashPages.delinquency) {
      dashPages.delinquency = await createDashboardPage('🔴 Delinquency Tracker', '🔴', parentPageId);
      console.log(`  ✅ Delinquency Tracker: ${dashPages.delinquency}`);
    }
    if (!dashPages.maintenance) {
      dashPages.maintenance = await createDashboardPage('🔧 Maintenance Board', '🔧', parentPageId);
      console.log(`  ✅ Maintenance Board: ${dashPages.maintenance}`);
    }
    if (!dashPages.works) {
      dashPages.works = await createDashboardPage('🏗️ Works & Projects', '🏗️', parentPageId);
      console.log(`  ✅ Works & Projects: ${dashPages.works}`);
    }

    // Save to config
    config.dashboards = dashPages;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('  ✅ Dashboard page IDs saved to config.json');
  }

  // Verify we have dashboard pages
  const required = ['kpi', 'financial', 'delinquency', 'maintenance', 'works'];
  const missing = required.filter(k => !dashPages[k]);
  if (missing.length) {
    console.error(`✗ Missing dashboard pages: ${missing.join(', ')}`);
    console.error('  Run: node refresh-dashboards.js --setup');
    process.exit(1);
  }

  // Fetch all data
  const data = await fetchAllData();

  // Build and refresh each dashboard
  const dashboards = {
    kpi:         { builder: buildKPIHub,                title: '📈 KPI Dashboard' },
    financial:   { builder: buildFinancialDashboard,    title: '📊 Financial Dashboard' },
    delinquency: { builder: buildDelinquencyDashboard,  title: '🔴 Delinquency Tracker' },
    maintenance: { builder: buildMaintenanceDashboard,  title: '🔧 Maintenance Board' },
    works:       { builder: buildWorksDashboard,        title: '🏗️ Works & Projects' },
  };

  for (const [key, { builder, title }] of Object.entries(dashboards)) {
    if (pageFilter && key !== pageFilter) continue;
    if (!dashPages[key]) continue;

    console.log(`\n🔄 Refreshing ${title}...`);
    try {
      const blocks = builder(data);
      await clearPageContent(dashPages[key]);
      await setPageContent(dashPages[key], blocks);
      console.log(`  ✅ ${title} — ${blocks.length} blocks`);
    } catch (e) {
      console.error(`  ⚠️ ${title} failed: ${e.message}`);
    }
  }

  console.log('\n✅ All dashboards refreshed!');
}

main().catch(e => { console.error(e); process.exit(1); });
