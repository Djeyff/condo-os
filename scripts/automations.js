#!/usr/bin/env node
// =============================================================================
// Condo Manager OS — Automation Workflows
// =============================================================================
// A polling-based automation engine that watches Notion databases for changes
// and triggers notifications + actions. Runs as a daemon or via cron.
//
// Usage:
//   node automations.js run          # Run all checks once (for cron)
//   node automations.js daemon       # Run continuously (poll every N minutes)
//   node automations.js test         # Dry-run — show what would trigger
//   node automations.js status       # Show automation config and last run
//
// Workflows:
//   1. Payment Received     → notify admin + owner confirmation
//   2. Maintenance Updated  → notify owner when status changes
//   3. Overdue Alert        → warn admin when unit goes 30+ days overdue
//   4. Meeting Reminder     → notify all owners before upcoming meeting
//   5. Expense Threshold    → alert admin when expense exceeds budget line
//   6. Balance Critical     → alert admin when cash position drops below threshold
//   7. New Maintenance      → notify admin when new request submitted (portal)
//
// State is persisted in automations-state.json to avoid duplicate notifications.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(
  os.homedir(), '.openclaw', 'skills', 'condo-manager-os', 'config.json'
);

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
  console.error('✗ Cannot read config.json');
  process.exit(1);
}

const DB       = config.databases || {};
const BUILDING = config.building  || {};
const CURRENCY = BUILDING.currency || 'DOP';
const AUTO     = config.automations || {};
const PORTAL   = config.portal || {};

// Notification settings
const NOTIFY = {
  adminChatId: PORTAL.adminChatId || AUTO.adminChatId || null,
  botToken:    PORTAL.botToken    || AUTO.botToken    || null,
  method:      AUTO.notifyMethod  || 'telegram',  // telegram | webhook | log
  webhookUrl:  AUTO.webhookUrl    || null,
};

// Thresholds
const THRESHOLDS = {
  overdueDays:       AUTO.overdueDays       || 30,
  cashCritical:      AUTO.cashCritical      || 10000,
  expenseBudgetPct:  AUTO.expenseBudgetPct  || 0.9,   // 90% of budget line
  meetingReminderMs: AUTO.meetingReminderMs || 48 * 60 * 60 * 1000, // 48h
  pollIntervalMs:    AUTO.pollIntervalMs    || 15 * 60 * 1000,      // 15 min
};

// ─────────────────────────────────────────────────────────────────────────────
// Bridge
// ─────────────────────────────────────────────────────────────────────────────

const BRIDGE_CANDIDATES = [
  path.join(__dirname, '..', 'bridge.js'),
  path.join(os.homedir(), '.openclaw', 'workspace', 'app', 'skills', 'notion', 'bridge.js'),
];

let bridge;
for (const bp of BRIDGE_CANDIDATES) {
  if (fs.existsSync(bp)) { bridge = require(bp); break; }
}
if (!bridge) { console.error('✗ Cannot find bridge.js'); process.exit(1); }

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
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (sorts)  body.sorts  = sorts;
    if (cursor) body.start_cursor = cursor;
    const res = await api(() => request('/databases/' + dbId + '/query', 'POST', JSON.stringify(body)));
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return pages;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property helpers
// ─────────────────────────────────────────────────────────────────────────────

function getTitle(page) {
  for (const p of Object.values(page.properties || {})) {
    if (p.type === 'title') return (p.title || []).map(t => t.plain_text).join('');
  }
  return '';
}
function getNumber(page, key) {
  const p = page?.properties?.[key];
  if (!p) return null;
  if (p.type === 'number')  return p.number;
  if (p.type === 'formula') return p.formula?.number;
  if (p.type === 'rollup')  return p.rollup?.number;
  return null;
}
function getText(page, key) {
  const p = page?.properties?.[key];
  if (!p) return '';
  if (p.type === 'rich_text') return (p.rich_text || []).map(t => t.plain_text).join('');
  if (p.type === 'title')     return (p.title || []).map(t => t.plain_text).join('');
  return '';
}
function getSelect(page, key) {
  const p = page?.properties?.[key];
  return p?.type === 'select' && p.select ? p.select.name : '';
}
function getDate(page, key) {
  const p = page?.properties?.[key];
  return p?.type === 'date' && p.date ? p.date.start : null;
}
function getRelationIds(page, key) {
  const p = page?.properties?.[key];
  return p?.type === 'relation' ? (p.relation || []).map(r => r.id) : [];
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function fmtMoney(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}${fmt(n)} ${CURRENCY}`;
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d.length === 10 ? d + 'T12:00:00Z' : d);
  return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// State persistence
// ─────────────────────────────────────────────────────────────────────────────

const STATE_FILE = path.join(path.dirname(CONFIG_PATH), 'automations-state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {}
  return {
    lastRun: null,
    seenPayments: [],           // ledger entry IDs we've already notified about
    maintenanceStatuses: {},    // { pageId: lastKnownStatus }
    seenMeetingReminders: [],   // meeting IDs we've reminded about
    seenOverdueAlerts: {},      // { unitPageId: lastAlertDate }
    seenMaintenanceRequests: [],// maintenance IDs we've notified about
  };
}

function saveState(state) {
  state.lastRun = new Date().toISOString();
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification
// ─────────────────────────────────────────────────────────────────────────────

const notifications = []; // collect during run, send at end

function notify(type, message, opts = {}) {
  notifications.push({ type, message, ...opts });
}

async function sendNotifications(dryRun = false) {
  if (!notifications.length) return;

  console.log(`\n📬 ${notifications.length} notification(s) to send:`);

  for (const n of notifications) {
    const prefix = {
      'payment':     '💰',
      'maintenance': '🔧',
      'overdue':     '🔴',
      'meeting':     '📅',
      'expense':     '💸',
      'cash':        '🏦',
      'portal':      '📱',
    }[n.type] || '📢';

    console.log(`  ${prefix} [${n.type}] ${n.message.slice(0, 100)}`);

    if (dryRun) continue;

    if (NOTIFY.method === 'telegram' && NOTIFY.botToken && NOTIFY.adminChatId) {
      try {
        const url = `https://api.telegram.org/bot${NOTIFY.botToken}/sendMessage`;
        const body = JSON.stringify({
          chat_id: NOTIFY.adminChatId,
          text: `${prefix} *${n.type.toUpperCase()}*\n\n${n.message}`,
          parse_mode: 'Markdown',
        });
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      } catch (e) {
        console.error(`  ⚠️ Telegram send failed: ${e.message}`);
      }
    }

    if (NOTIFY.method === 'webhook' && NOTIFY.webhookUrl) {
      try {
        await fetch(NOTIFY.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: n.type, message: n.message, timestamp: new Date().toISOString() }),
        });
      } catch (e) {
        console.error(`  ⚠️ Webhook send failed: ${e.message}`);
      }
    }

    // Also notify specific owner via portal bot if applicable
    if (n.ownerChatId && NOTIFY.botToken) {
      try {
        const url = `https://api.telegram.org/bot${NOTIFY.botToken}/sendMessage`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: n.ownerChatId,
            text: `${prefix} ${n.message}`,
            parse_mode: 'Markdown',
          }),
        });
      } catch (e) {}
    }
  }

  notifications.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal session lookup (to notify owners via Telegram)
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_FILE_PATH = path.join(path.dirname(CONFIG_PATH), 'portal-sessions.json');

function getOwnerChatId(unitPageId) {
  try {
    const sessions = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf8'));
    const entry = Object.entries(sessions).find(([, s]) => s.unitPageId === unitPageId && s.authenticated);
    return entry ? entry[0] : null; // Returns Telegram user ID
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 1: Payment Received
// ─────────────────────────────────────────────────────────────────────────────
// Watches Owner Ledger for new Payment entries → notifies admin + owner

async function checkPayments(state) {
  if (!DB.ownerLedger) return;
  console.log('  Checking payments...');

  const recent = await queryAll(DB.ownerLedger, {
    and: [
      { property: 'Type', select: { equals: 'Payment' } },
      { property: 'Date', date: { on_or_after: daysAgo(3) } },
    ]
  });

  let newCount = 0;
  for (const entry of recent) {
    if (state.seenPayments.includes(entry.id)) continue;

    const desc = getTitle(entry);
    const credit = getNumber(entry, 'Credit');
    const date = getDate(entry, 'Date');
    const unitRels = getRelationIds(entry, 'Unit');
    const unitId = unitRels[0];

    // Get unit info
    let unitName = '?', ownerName = '?';
    if (unitId) {
      try {
        const unit = await api(() => request('/pages/' + unitId, 'GET'));
        unitName = getTitle(unit);
        ownerName = getText(unit, 'Owner Name');
      } catch (e) {}
    }

    notify('payment',
      `Payment received from *${unitName}* (${ownerName})\n` +
      `Amount: *${fmtMoney(credit)}*\n` +
      `Date: ${fmtDate(date)}\n` +
      `Ref: ${desc}`,
      { ownerChatId: getOwnerChatId(unitId) }
    );

    state.seenPayments.push(entry.id);
    newCount++;
  }

  // Trim old seen entries (keep last 200)
  if (state.seenPayments.length > 200) {
    state.seenPayments = state.seenPayments.slice(-200);
  }

  console.log(`    ${newCount} new payment(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 2: Maintenance Status Changes
// ─────────────────────────────────────────────────────────────────────────────
// Watches Maintenance for status changes → notifies owner

async function checkMaintenanceUpdates(state) {
  if (!DB.maintenanceRequests) return;
  console.log('  Checking maintenance updates...');

  const all = await queryAll(DB.maintenanceRequests);
  let changes = 0;

  for (const req of all) {
    const status = getSelect(req, 'Status');
    const prevStatus = state.maintenanceStatuses[req.id];

    if (prevStatus && prevStatus !== status) {
      const title = getTitle(req);
      const unitRels = getRelationIds(req, 'Unit');
      const unitId = unitRels[0];

      let unitName = 'Common Area';
      if (unitId) {
        try {
          const unit = await api(() => request('/pages/' + unitId, 'GET'));
          unitName = getTitle(unit);
        } catch (e) {}
      }

      const statusEmoji = {
        'New': '🆕', 'Assigned': '👷', 'In Progress': '🔨',
        'Completed': '✅', 'Cancelled': '❌',
      }[status] || '🔧';

      notify('maintenance',
        `Maintenance update for *${unitName}*\n` +
        `Request: ${title}\n` +
        `Status: ${prevStatus} → ${statusEmoji} *${status}*`,
        { ownerChatId: unitId ? getOwnerChatId(unitId) : null }
      );
      changes++;
    }

    state.maintenanceStatuses[req.id] = status;
  }

  console.log(`    ${changes} status change(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 3: Overdue Alerts
// ─────────────────────────────────────────────────────────────────────────────
// Alerts admin when a unit is overdue by more than threshold days

async function checkOverdue(state) {
  if (!DB.units) return;
  console.log('  Checking overdue units...');

  const units = await queryAll(DB.units);
  const today = new Date();
  let alerts = 0;

  for (const unit of units) {
    const name = getTitle(unit);
    if (!name || name === '(template)') continue;

    const balance = getNumber(unit, 'Current Balance') ?? 0;
    if (balance >= 0) continue;

    const lastPay = getDate(unit, 'Last Payment Date');
    if (!lastPay) continue;

    const daysSince = Math.floor((today - new Date(lastPay + 'T12:00:00Z')) / 86400000);
    if (daysSince < THRESHOLDS.overdueDays) continue;

    // Check if we already alerted today
    const lastAlert = state.seenOverdueAlerts[unit.id];
    const todayStr = today.toISOString().slice(0, 10);
    if (lastAlert === todayStr) continue;

    const owner = getText(unit, 'Owner Name');
    const feeStatus = getSelect(unit, 'Fee Status');

    notify('overdue',
      `Unit *${name}* — ${owner}\n` +
      `Balance: *${fmtMoney(balance)}*\n` +
      `Days since last payment: *${daysSince}*\n` +
      `Status: ${feeStatus}`
    );

    state.seenOverdueAlerts[unit.id] = todayStr;
    alerts++;
  }

  console.log(`    ${alerts} overdue alert(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 4: Meeting Reminders
// ─────────────────────────────────────────────────────────────────────────────
// Reminds all owners 48h before a meeting

async function checkMeetings(state) {
  if (!DB.meetings) return;
  console.log('  Checking upcoming meetings...');

  const meetings = await queryAll(DB.meetings);
  const now = Date.now();
  let reminders = 0;

  for (const m of meetings) {
    if (state.seenMeetingReminders.includes(m.id)) continue;

    const date = getDate(m, 'Date');
    if (!date) continue;

    const meetingTime = new Date(date + 'T12:00:00Z').getTime();
    const timeUntil = meetingTime - now;

    if (timeUntil > 0 && timeUntil <= THRESHOLDS.meetingReminderMs) {
      const title = getTitle(m);
      const type = getSelect(m, 'Type');
      const hoursUntil = Math.round(timeUntil / 3600000);

      notify('meeting',
        `Upcoming meeting in *${hoursUntil} hours*\n\n` +
        `📅 *${title}*\n` +
        `Type: ${type}\n` +
        `Date: ${fmtDate(date)}`
      );

      state.seenMeetingReminders.push(m.id);
      reminders++;
    }
  }

  // Trim old
  if (state.seenMeetingReminders.length > 50) {
    state.seenMeetingReminders = state.seenMeetingReminders.slice(-50);
  }

  console.log(`    ${reminders} meeting reminder(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 5: Expense Budget Threshold
// ─────────────────────────────────────────────────────────────────────────────
// Alerts admin when cumulative expenses per budget line exceed threshold %

async function checkExpenseBudget(state) {
  if (!DB.expenses || !DB.budget) return;
  console.log('  Checking expense vs budget...');

  const budget = await queryAll(DB.budget);
  let alerts = 0;

  for (const line of budget) {
    const category = getTitle(line);
    const annual = getNumber(line, 'Annual Budget') || 0;
    if (!annual) continue;

    const actual = getNumber(line, 'Annual Actual') || 0;
    const pct = actual / annual;

    if (pct >= THRESHOLDS.expenseBudgetPct) {
      notify('expense',
        `Budget line *${category}* at *${(pct * 100).toFixed(0)}%*\n` +
        `Budget: ${fmtMoney(annual)}\n` +
        `Actual: ${fmtMoney(actual)}\n` +
        `Over by: ${fmtMoney(actual - annual)}`
      );
      alerts++;
    }
  }

  console.log(`    ${alerts} budget alert(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 6: Cash Position Critical
// ─────────────────────────────────────────────────────────────────────────────

async function checkCashPosition(state) {
  if (!DB.cashPosition) return;
  console.log('  Checking cash position...');

  const accounts = await queryAll(DB.cashPosition);
  let total = 0;
  const details = [];

  for (const acc of accounts) {
    const name = getTitle(acc);
    const balance = getNumber(acc, 'Current Balance') || 0;
    total += balance;
    details.push(`${name}: ${fmtMoney(balance)}`);
  }

  if (total < THRESHOLDS.cashCritical) {
    notify('cash',
      `⚠️ Cash position below critical threshold\n\n` +
      `Total: *${fmtMoney(total)}*\n` +
      `Threshold: ${fmtMoney(THRESHOLDS.cashCritical)}\n\n` +
      details.join('\n')
    );
  }

  console.log(`    Total: ${fmtMoney(total)} (threshold: ${fmtMoney(THRESHOLDS.cashCritical)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW 7: New Maintenance Requests (from Portal)
// ─────────────────────────────────────────────────────────────────────────────

async function checkNewMaintenance(state) {
  if (!DB.maintenanceRequests) return;
  console.log('  Checking new maintenance requests...');

  const recent = await queryAll(DB.maintenanceRequests, {
    and: [
      { property: 'Status', select: { equals: 'New' } },
      { property: 'Reported Date', date: { on_or_after: daysAgo(3) } },
    ]
  });

  let newCount = 0;
  for (const req of recent) {
    if (state.seenMaintenanceRequests.includes(req.id)) continue;

    const title = getTitle(req);
    const priority = getSelect(req, 'Priority');
    const location = getText(req, 'Location');
    const reporter = getText(req, 'Reported By');
    const unitRels = getRelationIds(req, 'Unit');

    let unitName = 'Common Area';
    if (unitRels[0]) {
      try {
        const unit = await api(() => request('/pages/' + unitRels[0], 'GET'));
        unitName = getTitle(unit);
      } catch (e) {}
    }

    notify('portal',
      `New maintenance request\n\n` +
      `Unit: *${unitName}*\n` +
      `Issue: ${title}\n` +
      `Location: ${location}\n` +
      `Priority: ${priority}\n` +
      `Reported by: ${reporter}`
    );

    state.seenMaintenanceRequests.push(req.id);
    newCount++;
  }

  if (state.seenMaintenanceRequests.length > 100) {
    state.seenMaintenanceRequests = state.seenMaintenanceRequests.slice(-100);
  }

  console.log(`    ${newCount} new request(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Runner
// ─────────────────────────────────────────────────────────────────────────────

async function runAll(dryRun = false) {
  const state = loadState();
  const start = Date.now();

  console.log(`\n🔄 Running automation checks — ${new Date().toISOString()}`);
  console.log(`Building: ${BUILDING.name || '?'}`);
  console.log(`Notify: ${NOTIFY.method} | Admin: ${NOTIFY.adminChatId || 'none'}`);
  console.log('');

  try {
    await checkPayments(state);
    await checkMaintenanceUpdates(state);
    await checkOverdue(state);
    await checkMeetings(state);
    await checkExpenseBudget(state);
    await checkCashPosition(state);
    await checkNewMaintenance(state);
  } catch (e) {
    console.error(`\n⚠️ Error during checks: ${e.message}`);
  }

  await sendNotifications(dryRun);
  saveState(state);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s | Last run: ${state.lastRun}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const command = process.argv[2] || 'run';

switch (command) {
  case 'run':
    runAll(false).catch(e => { console.error(e); process.exit(1); });
    break;

  case 'test':
  case 'dry-run':
    runAll(true).catch(e => { console.error(e); process.exit(1); });
    break;

  case 'daemon': {
    const interval = THRESHOLDS.pollIntervalMs;
    console.log(`🤖 Automation daemon starting (poll every ${interval / 60000} min)`);
    const loop = async () => {
      await runAll(false);
      setTimeout(loop, interval);
    };
    loop();
    break;
  }

  case 'status': {
    const state = loadState();
    console.log('\n📊 Automation Status');
    console.log('═'.repeat(50));
    console.log(`Last run:            ${state.lastRun || 'never'}`);
    console.log(`Seen payments:       ${state.seenPayments?.length || 0}`);
    console.log(`Tracked maintenance: ${Object.keys(state.maintenanceStatuses || {}).length}`);
    console.log(`Meeting reminders:   ${state.seenMeetingReminders?.length || 0}`);
    console.log(`Overdue alerts:      ${Object.keys(state.seenOverdueAlerts || {}).length}`);
    console.log(`\nNotify method:       ${NOTIFY.method}`);
    console.log(`Admin chat ID:       ${NOTIFY.adminChatId || 'not set'}`);
    console.log(`Bot token:           ${NOTIFY.botToken ? '***' + NOTIFY.botToken.slice(-4) : 'not set'}`);
    console.log(`\nThresholds:`);
    console.log(`  Overdue days:      ${THRESHOLDS.overdueDays}`);
    console.log(`  Cash critical:     ${fmtMoney(THRESHOLDS.cashCritical)}`);
    console.log(`  Budget alert:      ${(THRESHOLDS.expenseBudgetPct * 100)}%`);
    console.log(`  Meeting reminder:  ${THRESHOLDS.meetingReminderMs / 3600000}h before`);
    console.log(`  Poll interval:     ${THRESHOLDS.pollIntervalMs / 60000} min`);
    break;
  }

  default:
    console.log('Usage: node automations.js [run|test|daemon|status]');
    process.exit(1);
}
