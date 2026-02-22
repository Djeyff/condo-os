#!/usr/bin/env node
// =============================================================================
// Condo Manager OS v3.0 — Main CLI
// =============================================================================
// Usage: node condo-cli.js <command> [options]
// Run without arguments or with --help to see all commands.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─────────────────────────────────────────────────────────────────────────────
// Config Loading
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(
  os.homedir(), '.openclaw', 'skills', 'condo-manager-os', 'config.json'
);

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
  console.error(`✗  Cannot read config.json`);
  console.error(`   Expected at: ${CONFIG_PATH}`);
  console.error(`   Run 'node setup.js' first to configure your building.`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Loading (check local first, then workspace fallback)
// ─────────────────────────────────────────────────────────────────────────────

const BRIDGE_CANDIDATES = [
  path.join(__dirname, '..', 'bridge.js'),
  path.join(os.homedir(), '.openclaw', 'workspace', 'app', 'skills', 'notion', 'bridge.js'),
];

let bridge;
for (const bp of BRIDGE_CANDIDATES) {
  if (fs.existsSync(bp)) { bridge = require(bp); break; }
}
if (!bridge) {
  console.error('✗  Cannot find bridge.js. Checked:');
  BRIDGE_CANDIDATES.forEach(p => console.error(`   - ${p}`));
  process.exit(1);
}

const { request } = bridge;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DB       = config.databases || {};
const BUILDING = config.building  || {};
const CURRENCY = BUILDING.currency || 'DOP';
const RATE_MS  = 350; // ms between Notion API calls

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Colors
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
  dim:    '\x1b[2m',
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Format a number with thousands separator (no currency symbol) */
function fmt(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return (n < 0 ? '-' : '') + str;
}

/** Format with currency suffix */
function fmtMoney(n) {
  return `${fmt(n)} ${CURRENCY}`;
}

/** Convert a date string or Date object → DD/MM/YYYY */
function fmtDate(d) {
  if (!d) return '';
  // ISO string YYYY-MM-DD → parse as UTC noon to avoid TZ issues
  const dt = typeof d === 'string'
    ? new Date(d.length === 10 ? d + 'T12:00:00Z' : d)
    : d;
  const day   = String(dt.getUTCDate()).padStart(2, '0');
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${dt.getUTCFullYear()}`;
}

/** Convert input to YYYY-MM-DD (accepts DD/MM/YYYY, YYYY-MM-DD, or Date) */
function toISO(input) {
  if (!input) return todayISO();
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  input = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
    const [d, m, y] = input.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // Try native parse as fallback
  const dt = new Date(input);
  if (!isNaN(dt)) return dt.toISOString().slice(0, 10);
  return input;
}

/** Today as YYYY-MM-DD (UTC) */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Determine Fee Status from balance.
 * lastPaymentDate (ISO string) is used to estimate days overdue.
 */
function calcFeeStatus(balance, lastPaymentDate) {
  if (balance >= 0) return 'Current';
  if (!lastPaymentDate) return 'Overdue 90+';
  const msPerDay = 86400000;
  const days = Math.floor((Date.now() - new Date(lastPaymentDate + 'T12:00:00Z')) / msPerDay);
  if (days <= 30)  return 'Overdue 1-30';
  if (days <= 60)  return 'Overdue 31-60';
  if (days <= 90)  return 'Overdue 61-90';
  return 'Overdue 90+';
}

/**
 * Normalize a unit ID for matching:
 * "a1" → "A-1", "A1" → "A-1", "a-1" → "A-1", "A-1" → "A-1"
 */
function normalizeUnitId(s) {
  if (!s) return '';
  s = s.trim().toUpperCase();
  if (/^[A-Z]+-\d+$/.test(s)) return s; // already normalized
  const m = s.match(/^([A-Z]+)-?(\d+)$/);
  if (m) return `${m[1]}-${m[2]}`;
  return s;
}

/** Find a unit by partial/case-insensitive ID match */
function matchUnit(units, input) {
  const norm = normalizeUnitId(input);
  // Exact normalized match first
  let found = units.find(u => normalizeUnitId(getTitle(u)) === norm);
  if (found) return found;
  // Substring match
  found = units.find(u => normalizeUnitId(getTitle(u)).includes(norm) || norm.includes(normalizeUnitId(getTitle(u))));
  return found || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notion Property Getters
// ─────────────────────────────────────────────────────────────────────────────

function getTitle(page) {
  if (!page || !page.properties) return '';
  for (const p of Object.values(page.properties)) {
    if (p.type === 'title') return (p.title || []).map(t => t.plain_text).join('');
  }
  return '';
}

function getNumber(page, key) {
  const p = page && page.properties && page.properties[key];
  if (!p) return null;
  if (p.type === 'number')  return p.number;
  if (p.type === 'formula') return p.formula.type === 'number' ? p.formula.number : null;
  return null;
}

function getText(page, key) {
  const p = page && page.properties && page.properties[key];
  if (!p) return '';
  if (p.type === 'rich_text')   return (p.rich_text  || []).map(t => t.plain_text).join('');
  if (p.type === 'title')       return (p.title      || []).map(t => t.plain_text).join('');
  if (p.type === 'email')       return p.email        || '';
  if (p.type === 'phone_number')return p.phone_number || '';
  return '';
}

function getSelect(page, key) {
  const p = page && page.properties && page.properties[key];
  if (!p) return '';
  if (p.type === 'select') return p.select ? p.select.name : '';
  return '';
}

function getDate(page, key) {
  const p = page && page.properties && page.properties[key];
  if (!p) return null;
  if (p.type === 'date') return p.date ? p.date.start : null;
  return null;
}

function getRelationIds(page, key) {
  const p = page && page.properties && page.properties[key];
  if (!p || p.type !== 'relation') return [];
  return (p.relation || []).map(r => r.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Notion Property Builders
// ─────────────────────────────────────────────────────────────────────────────

const prop = {
  title:     v  => ({ title:        [{ text: { content: String(v) } }] }),
  text:      v  => ({ rich_text:    [{ text: { content: String(v) } }] }),
  number:    v  => ({ number:       v }),
  select:    v  => ({ select:       { name: String(v) } }),
  date:      v  => ({ date:         { start: toISO(v) } }),
  relation:  ids=> ({ relation:     (ids || []).map(id => ({ id })) }),
  checkbox:  v  => ({ checkbox:     Boolean(v) }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Notion API Wrapper (rate-limited)
// ─────────────────────────────────────────────────────────────────────────────

let _lastCall = 0;

async function api(fn) {
  const wait = RATE_MS - (Date.now() - _lastCall);
  if (wait > 0) await sleep(wait);
  const res = await fn();
  _lastCall = Date.now();
  return res;
}

/** Query a database with full pagination, optional filter + sorts. */
async function queryAll(dbId, filter = null, sorts = null) {
  if (!dbId) throw new Error(`Database ID not configured. Check config.json.`);
  const results = [];
  let cursor;
  for (;;) {
    const payload = { page_size: 100 };
    if (filter) payload.filter = filter;
    if (sorts)  payload.sorts  = sorts;
    if (cursor) payload.start_cursor = cursor;
    const data = await api(() => request(`/databases/${dbId}/query`, 'POST', JSON.stringify(payload)));
    results.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

/** Create a page in a database. */
async function createPage(dbId, properties) {
  if (!dbId) throw new Error(`Database ID not configured. Check config.json.`);
  const body = JSON.stringify({ parent: { database_id: dbId }, properties });
  return api(() => request('/pages', 'POST', body));
}

/** Update an existing page. */
async function updatePage(pageId, properties) {
  const body = JSON.stringify({ properties });
  return api(() => request(`/pages/${pageId}`, 'PATCH', body));
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Layout Helpers
// ─────────────────────────────────────────────────────────────────────────────

function padR(s, n) { return String(s).padEnd(n); }
function padL(s, n) { return String(s).padStart(n); }

function tableRow(cells, widths, aligns = []) {
  return cells.map((c, i) => {
    const w = widths[i] || 12;
    const a = aligns[i] || 'left';
    return a === 'right' ? padL(String(c), w) : padR(String(c), w);
  }).join('  ');
}

function separator(widths, char = '─') {
  return widths.map(w => char.repeat(w)).join('──');
}

function boxTop(width, char = '═')    { return char.repeat(width); }
function boxLine(text, width) {
  return ` ${text}`.padEnd(width - 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// i18n Labels (statement command only)
// ─────────────────────────────────────────────────────────────────────────────

const L10N = {
  en: {
    title: 'ACCOUNT STATEMENT', unit: 'Unit', owner: 'Owner', share: 'Share',
    period: 'Period', date: 'Date', description: 'Description',
    debit: 'Debit', credit: 'Credit', balance: 'Balance',
    opening: 'Balance brought forward', closing: 'Closing Balance',
  },
  es: {
    title: 'ESTADO DE CUENTA', unit: 'Unidad', owner: 'Propietario', share: 'Participación',
    period: 'Período', date: 'Fecha', description: 'Descripción',
    debit: 'Débito', credit: 'Crédito', balance: 'Saldo',
    opening: 'Saldo anterior', closing: 'Saldo Final',
  },
  fr: {
    title: 'RELEVÉ DE COMPTE', unit: 'Unité', owner: 'Propriétaire', share: 'Quote-part',
    period: 'Période', date: 'Date', description: 'Description',
    debit: 'Débit', credit: 'Crédit', balance: 'Solde',
    opening: 'Solde reporté', closing: 'Solde final',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CLI Argument Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseCli(argv) {
  const args = argv.slice(2);
  const pos  = [];
  const opts = {};
  for (const a of args) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) opts[a.slice(2, eq)] = a.slice(eq + 1);
      else           opts[a.slice(2)]     = true;
    } else {
      pos.push(a);
    }
  }
  return { pos, opts };
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: fee-call <Q1|Q2|Q3|Q4|YYYY-MM> [year]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdFeeCall(pos, opts) {
  let period = pos[1];
  let year   = pos[2] ? parseInt(pos[2]) : new Date().getFullYear();

  if (!period) {
    die('Usage: fee-call <Q1|Q2|Q3|Q4|YYYY-MM> [year]\n  Ex: fee-call Q2 2026\n  Ex: fee-call 2026-01');
  }

  // Support combined "Q2-2026" or "Q2_2026"
  const combo = period.match(/^(Q\d)[-_](\d{4})$/i);
  if (combo) { period = combo[1]; year = parseInt(combo[2]); }

  const isQuarterly = /^Q[1-4]$/i.test(period);
  const isMonthly   = /^\d{4}-\d{2}$/.test(period) || /^\d{2}$/.test(period);

  if (!isQuarterly && !isMonthly) {
    die(`Invalid period '${period}'. Use Q1–Q4 for quarterly, or YYYY-MM for monthly.`);
  }

  const divisor     = isQuarterly ? 4 : 12;
  const periodLabel = isQuarterly ? `${period.toUpperCase()} ${year}` : `${period}`;
  const callDate    = toISO(opts.date) || todayISO();
  const annualBudget= BUILDING.annualBudget || 0;

  if (!annualBudget) die('annualBudget is 0 or missing in config.json.');

  console.log(`\n${C.bold}${C.cyan}📋 FEE CALL — ${periodLabel}${C.reset}`);
  console.log(`Annual Budget: ${fmtMoney(annualBudget)}  |  Frequency: ${isQuarterly ? 'Quarterly ÷4' : 'Monthly ÷12'}`);
  console.log(`Date: ${fmtDate(callDate)}\n`);

  process.stdout.write(`${C.grey}Fetching units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log(` ${units.length} found`);

  const W = [8, 26, 9, 14, 14, 14];
  const H = ['Unit', 'Owner', 'Share %', 'Amount', 'Old Balance', 'New Balance'];
  console.log('\n' + tableRow(H, W));
  console.log(separator(W));

  let totalCalled = 0;

  for (const unit of units) {
    const uid        = getTitle(unit);
    const owner      = getText(unit, 'Owner Name').substring(0, 25);
    const ownership  = getNumber(unit, 'Ownership Share (%)') || 0;
    const oldBalance = getNumber(unit, 'Current Balance') || 0;
    const amount     = Math.round(annualBudget * ownership / 100 / divisor * 100) / 100;
    const newBalance = Math.round((oldBalance - amount) * 100) / 100;
    totalCalled     += amount;

    // Ledger entry
    await createPage(DB.ledger, {
      'Entry':       prop.title(`${uid} — ${periodLabel} Common Charges`),
      'Unit':        prop.relation([unit.id]),
      'Date':        prop.date(callDate),
      'Type':        prop.select('Fee Call'),
      'Debit':       prop.number(amount),
      'Balance After': prop.number(newBalance),
      'Period':      prop.text(periodLabel),
      'Category':    prop.select('Common Charges'),
      'Fiscal Year': prop.number(year),
    });

    // Update unit
    await updatePage(unit.id, {
      'Current Balance': prop.number(newBalance),
      'Fee Status':      prop.select(calcFeeStatus(newBalance, getDate(unit, 'Last Payment Date'))),
    });

    const flag = newBalance >= 0 ? '✅' : '⚠️ ';
    console.log(tableRow(
      [uid, owner, `${ownership.toFixed(2)}%`, fmt(amount), fmt(oldBalance), `${flag} ${fmt(newBalance)}`],
      W
    ));
  }

  console.log(separator(W, '═'));
  console.log(`\n${C.green}✓${C.reset} Fee call ${C.bold}${periodLabel}${C.reset} issued for ${units.length} units`);
  console.log(`  Total called: ${C.bold}${fmtMoney(totalCalled)}${C.reset}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: payment <unit> <amount> [options]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdPayment(pos, opts) {
  const unitInput = pos[1];
  const amount    = parseFloat(pos[2]);

  if (!unitInput || isNaN(amount) || amount <= 0) {
    die('Usage: payment <unit> <amount> [--method=transfer] [--ref=xxx] [--date=YYYY-MM-DD]');
  }

  const payDate = toISO(opts.date) || todayISO();
  const ref     = opts.ref     ? String(opts.ref) : '';
  const rawMethod = (opts.method || 'bank transfer').toLowerCase();

  const methodMap = {
    'transfer':     'Bank Transfer',
    'bank transfer':'Bank Transfer',
    'wire':         'Bank Transfer',
    'cash':         'Cash',
    'check':        'Check',
    'cheque':       'Check',
    'credit card':  'Credit Card',
    'card':         'Credit Card',
    'offset':       'Offset/Credit',
    'credit':       'Offset/Credit',
  };
  const notionMethod = methodMap[rawMethod] || 'Bank Transfer';

  process.stdout.write(`${C.grey}Fetching units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log();

  const unit = matchUnit(units, unitInput);
  if (!unit) {
    const avail = units.map(u => getTitle(u)).join(', ');
    die(`Unit '${unitInput}' not found.\nAvailable: ${avail}`);
  }

  const uid        = getTitle(unit);
  const owner      = getText(unit, 'Owner Name');
  const oldBalance = getNumber(unit, 'Current Balance') || 0;
  const newBalance = Math.round((oldBalance + amount) * 100) / 100;
  const lastPay    = getDate(unit, 'Last Payment Date');
  const newStatus  = calcFeeStatus(newBalance, newBalance < 0 ? lastPay : payDate);

  // Ledger entry
  process.stdout.write('Creating ledger entry...');
  const entryDesc = ref
    ? `Payment — ${notionMethod} #${ref}`
    : `Payment — ${notionMethod}`;

  const ledgerProps = {
    'Entry':          prop.title(`${uid} — Payment ${fmtDate(payDate)}`),
    'Unit':           prop.relation([unit.id]),
    'Date':           prop.date(payDate),
    'Type':           prop.select('Payment Received'),
    'Credit':         prop.number(amount),
    'Balance After':  prop.number(newBalance),
    'Payment Method': prop.select(notionMethod),
    'Category':       prop.select('Common Charges'),
  };
  if (ref) ledgerProps['Reference'] = prop.text(ref);

  await createPage(DB.ledger, ledgerProps);
  console.log(' ✓');

  // Update unit
  process.stdout.write('Updating unit...');
  await updatePage(unit.id, {
    'Current Balance':  prop.number(newBalance),
    'Fee Status':       prop.select(newStatus),
    'Last Payment Date':prop.date(payDate),
  });
  console.log(' ✓');

  const balArrow = newBalance >= oldBalance ? C.green : C.red;
  console.log(`\n${C.green}✓ PAYMENT RECORDED${C.reset}`);
  console.log(`  Unit:    ${C.bold}${uid}${C.reset} — ${owner}`);
  console.log(`  Amount:  ${C.bold}${fmtMoney(amount)}${C.reset}`);
  console.log(`  Method:  ${notionMethod}${ref ? ` (#${ref})` : ''}`);
  console.log(`  Date:    ${fmtDate(payDate)}`);
  console.log(`  Balance: ${balArrow}${fmtMoney(oldBalance)} → ${fmtMoney(newBalance)}${C.reset}  ${newBalance >= 0 ? '✅' : '⚠️'}`);
  console.log(`  Status:  ${newStatus}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: statement <unit> [options]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdStatement(pos, opts) {
  const unitInput = pos[1];
  if (!unitInput) {
    die('Usage: statement <unit> [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--lang=en|es|fr]');
  }

  const lang = ((opts.lang || 'es').toLowerCase());
  const L    = L10N[lang] || L10N.es;
  const from = opts.from ? toISO(opts.from) : null;
  const to   = opts.to   ? toISO(opts.to)   : null;

  process.stdout.write(`${C.grey}Fetching units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log();

  const unit = matchUnit(units, unitInput);
  if (!unit) {
    const avail = units.map(u => getTitle(u)).join(', ');
    die(`Unit '${unitInput}' not found.\nAvailable: ${avail}`);
  }

  const uid        = getTitle(unit);
  const owner      = getText(unit, 'Owner Name');
  const ownership  = getNumber(unit, 'Ownership Share (%)') || 0;
  const curBalance = getNumber(unit, 'Current Balance') || 0;

  // Build filter
  const andFilters = [{ property: 'Unit', relation: { contains: unit.id } }];
  if (from) andFilters.push({ property: 'Date', date: { on_or_after:  from } });
  if (to)   andFilters.push({ property: 'Date', date: { on_or_before: to   } });

  const filter = andFilters.length === 1 ? andFilters[0] : { and: andFilters };
  const sorts  = [{ property: 'Date', direction: 'ascending' }];

  process.stdout.write('Fetching ledger entries...');
  const entries = await queryAll(DB.ledger, filter, sorts);
  console.log(` ${entries.length} entries`);

  // ── Header ─────────────────────────────────────────────────────────────────
  const W = 82;
  const title = ` ${L.title} — ${L.unit} ${uid} `;
  console.log('\n' + boxTop(W));
  console.log(title.padEnd(W));
  console.log(boxTop(W));
  console.log(`${L.owner}: ${owner} | ${L.share}: ${ownership.toFixed(2)}%`);
  if (from || to) {
    const pFrom = from ? fmtDate(from) : '...';
    const pTo   = to   ? fmtDate(to)   : '...';
    console.log(`${L.period}: ${pFrom} — ${pTo}`);
  }
  console.log();

  // ── Table header ───────────────────────────────────────────────────────────
  const dW = 12, descW = 34, dbW = 12, crW = 12, balW = 12;
  console.log(
    padR(L.date, dW) + padR(L.description, descW) +
    padL(L.debit, dbW) + padL(L.credit, crW) + padL(L.balance, balW)
  );
  console.log('─'.repeat(dW + descW + dbW + crW + balW));

  // ── Rows ───────────────────────────────────────────────────────────────────
  let runBal = null;

  for (let i = 0; i < entries.length; i++) {
    const e       = entries[i];
    const eDate   = getDate(e, 'Date');
    const eTitle  = getText(e, 'Entry');
    const eDebit  = getNumber(e, 'Debit')  || 0;
    const eCredit = getNumber(e, 'Credit') || 0;
    const balAfter= getNumber(e, 'Balance After');

    // On first entry, show opening balance line (if filtering by date)
    if (runBal === null) {
      if (balAfter !== null) {
        // Back-calculate opening from Balance After
        runBal = balAfter + eDebit - eCredit;
      } else {
        runBal = 0;
      }
      if (from || to) {
        console.log(
          padR(fmtDate(from || eDate), dW) +
          padR(L.opening, descW) +
          padL('', dbW) + padL('', crW) +
          padL(fmt(runBal), balW)
        );
      }
    }

    // Advance running balance
    if (balAfter !== null) {
      runBal = balAfter;
    } else {
      runBal = Math.round((runBal - eDebit + eCredit) * 100) / 100;
    }

    // Shorten description: strip "UnitID — " prefix
    const shortDesc = eTitle.replace(new RegExp(`^${uid}\\s*—\\s*`), '').substring(0, descW - 2);

    console.log(
      padR(fmtDate(eDate), dW) +
      padR(shortDesc, descW) +
      padL(eDebit  > 0 ? fmt(eDebit)  : '', dbW) +
      padL(eCredit > 0 ? fmt(eCredit) : '', crW) +
      padL(fmt(runBal), balW)
    );
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  console.log('═'.repeat(dW + descW + dbW + crW + balW));
  const closing = entries.length > 0 ? runBal : curBalance;
  const closingColor = closing >= 0 ? C.green : C.red;
  console.log(`${L.closing}: ${closingColor}${C.bold}${fmtMoney(closing)}${C.reset}`);
  console.log();
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: report [monthly|quarterly] <period>
// ═════════════════════════════════════════════════════════════════════════════

async function cmdReport(pos, opts) {
  // Flexible arg parsing
  let type   = (pos[1] || '').toLowerCase();
  let period = pos[2] || '';

  // Auto-detect if type is actually the period
  if (!period) {
    if (/^\d{4}-\d{2}$/.test(type))        { period = type; type = 'monthly'; }
    else if (/^Q\d[-_]?\d{4}$/i.test(type)){ period = type; type = 'quarterly'; }
    else { die('Usage: report [monthly|quarterly] <period>\n  Ex: report monthly 2026-01\n  Ex: report quarterly Q1-2026'); }
  }

  // Parse date range
  let fromDate, toDate, reportTitle;

  if (type === 'monthly' || /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-');
    fromDate = `${y}-${m.padStart(2,'0')}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    toDate   = `${y}-${m.padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    reportTitle = `${MONTHS[parseInt(m)-1]} ${y}`;
  } else {
    // Quarterly: Q1-2026 or Q1_2026 or Q12026
    const m = period.match(/^(Q[1-4])[-_]?(\d{4})$/i);
    if (!m) die(`Cannot parse quarterly period: '${period}'. Use Q1-2026 format.`);
    const [, q, y] = m;
    const qn = parseInt(q[1]);
    const starts = [null,'01-01','04-01','07-01','10-01'];
    const ends   = [null,'03-31','06-30','09-30','12-31'];
    fromDate    = `${y}-${starts[qn]}`;
    toDate      = `${y}-${ends[qn]}`;
    reportTitle = `${q.toUpperCase()} ${y}`;
  }

  const W = 64;
  console.log(`\n${boxTop(W)}`);
  console.log(boxLine(`FINANCIAL REPORT — ${reportTitle}`, W));
  console.log(boxTop(W));
  console.log(`Period: ${fmtDate(fromDate)} — ${fmtDate(toDate)}\n`);

  const dateFilter = {
    and: [
      { property: 'Date', date: { on_or_after:  fromDate } },
      { property: 'Date', date: { on_or_before: toDate   } },
    ]
  };

  // ── INCOME ─────────────────────────────────────────────────────────────────
  process.stdout.write(`${C.grey}Loading ledger...${C.reset}`);
  const ledger = await queryAll(DB.ledger, dateFilter);
  console.log(` ${ledger.length} entries`);

  let feeCalls = 0, payments = 0;
  for (const e of ledger) {
    const t = getSelect(e, 'Type');
    if (t === 'Fee Call')         feeCalls += getNumber(e, 'Debit')  || 0;
    if (t === 'Payment Received') payments += getNumber(e, 'Credit') || 0;
  }
  const collRate = feeCalls > 0 ? `${(payments / feeCalls * 100).toFixed(1)}%` : 'N/A';

  console.log(`\n${C.bold}INCOME:${C.reset}`);
  console.log(`  Fee calls issued:    ${padL(fmtMoney(feeCalls), 22)}`);
  console.log(`  Payments received:   ${padL(fmtMoney(payments), 22)}`);
  console.log(`  Collection rate:     ${padL(collRate, 22)}`);

  // ── EXPENSES ───────────────────────────────────────────────────────────────
  process.stdout.write(`${C.grey}Loading expenses...${C.reset}`);
  const expenses = await queryAll(DB.expenses, dateFilter);
  console.log(` ${expenses.length} entries`);

  const expByCat = {};
  let totalActual = 0;
  for (const e of expenses) {
    const cat = getSelect(e, 'Category') || 'Uncategorized';
    const amt = getNumber(e, 'Amount') || 0;
    expByCat[cat] = (expByCat[cat] || 0) + amt;
    totalActual  += amt;
  }

  // Budget
  process.stdout.write(`${C.grey}Loading budget...${C.reset}`);
  const budgetItems = await queryAll(DB.budget);
  console.log();
  const isMon = type === 'monthly';
  const budgByCat = {};
  let totalBudget = 0;
  for (const b of budgetItems) {
    const cat    = getTitle(b);
    const annual = getNumber(b, 'Annual Budget') || 0;
    const budget = annual / (isMon ? 12 : 4);
    budgByCat[cat] = budget;
    totalBudget   += budget;
  }

  const EW = [24, 11, 11, 16];
  const EH = ['Category', 'Budget', 'Actual', 'Variance'];
  console.log(`\n${C.bold}EXPENSES BY CATEGORY:${C.reset}`);
  console.log(tableRow(EH, EW));
  console.log(separator(EW));

  const allCats = [...new Set([...Object.keys(expByCat), ...Object.keys(budgByCat)])].sort();
  for (const cat of allCats) {
    const actual  = expByCat[cat]  || 0;
    const budget  = budgByCat[cat] || 0;
    const diff    = actual - budget;
    const flag    = diff <= 0 ? '✅' : '⚠️ ';
    console.log(tableRow(
      [cat.substring(0, 23), fmt(budget), fmt(actual), `${fmt(diff)} ${flag}`],
      EW
    ));
  }
  const totalDiff = totalActual - totalBudget;
  console.log(separator(EW));
  console.log(tableRow(
    ['TOTAL', fmt(totalBudget), fmt(totalActual), `${fmt(totalDiff)} ${totalDiff <= 0 ? '✅' : '⚠️'}`],
    EW
  ));

  // ── CASH POSITION ──────────────────────────────────────────────────────────
  process.stdout.write(`${C.grey}Loading cash position...${C.reset}`);
  const cashAccts = await queryAll(DB.cashPosition);
  console.log();

  let totalCash = 0;
  console.log(`\n${C.bold}CASH POSITION:${C.reset}`);
  for (const acc of cashAccts) {
    const name = getTitle(acc);
    const bal  = getNumber(acc, 'Current Balance') || 0;
    totalCash += bal;
    const icon = bal >= 0 ? '' : '⚠️ ';
    console.log(`  ${icon}${padR(name + ':', 28)} ${fmtMoney(bal)}`);
  }
  console.log(`  ${'─'.repeat(42)}`);
  console.log(`  ${padR('TOTAL:', 28)} ${C.bold}${fmtMoney(totalCash)}${C.reset}`);

  // ── DELINQUENCY ────────────────────────────────────────────────────────────
  process.stdout.write(`${C.grey}Loading units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log();

  const delinquent = units
    .filter(u => (getNumber(u, 'Current Balance') || 0) < 0)
    .sort((a,b) => (getNumber(a,'Current Balance')||0) - (getNumber(b,'Current Balance')||0));

  if (delinquent.length > 0) {
    const DW = [8, 22, 14, 16];
    const DH = ['Unit', 'Owner', 'Balance', 'Status'];
    console.log(`\n${C.bold}DELINQUENCY:${C.reset}`);
    console.log(tableRow(DH, DW));
    console.log(separator(DW));

    let totalOwed = 0;
    for (const u of delinquent) {
      const uid    = getTitle(u);
      const owner  = getText(u, 'Owner Name').substring(0, 21);
      const bal    = getNumber(u, 'Current Balance') || 0;
      const status = getSelect(u, 'Fee Status');
      totalOwed   += bal;
      const flag   = status.includes('90+') ? '⚠️ ' : '';
      console.log(tableRow([uid, owner, fmt(bal), `${flag}${status}`], DW));
    }
    console.log(`\n  TOTAL OUTSTANDING: ${C.bold}${C.red}${fmtMoney(totalOwed)}${C.reset}`);
  } else {
    console.log(`\n${C.green}✅ No delinquent units!${C.reset}`);
  }

  console.log(`\n${boxTop(W)}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: delinquency [--detail]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdDelinquency(pos, opts) {
  console.log(`\n${C.bold}📊 DELINQUENCY REPORT${C.reset}\n`);

  process.stdout.write(`${C.grey}Fetching units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log(` ${units.length} units`);

  const delinquent = units
    .filter(u => (getNumber(u, 'Current Balance') || 0) < 0)
    .sort((a,b) => (getNumber(a,'Current Balance')||0) - (getNumber(b,'Current Balance')||0));

  if (delinquent.length === 0) {
    console.log(`\n${C.green}✅ No delinquent units! All owners are current.${C.reset}`);
    return;
  }

  const W = [8, 26, 14, 16, 14];
  const H = ['Unit', 'Owner', 'Balance', 'Status', 'Last Payment'];
  console.log('\n' + tableRow(H, W));
  console.log(separator(W));

  let totalOwed = 0;

  for (const u of delinquent) {
    const uid     = getTitle(u);
    const owner   = getText(u, 'Owner Name').substring(0, 25);
    const bal     = getNumber(u, 'Current Balance') || 0;
    const status  = getSelect(u, 'Fee Status');
    const lastPay = getDate(u, 'Last Payment Date');
    totalOwed    += bal;

    const flag = status.includes('90+') ? `${C.red}` : '';
    console.log(flag + tableRow(
      [uid, owner, fmt(bal), status, lastPay ? fmtDate(lastPay) : 'Never'],
      W
    ) + C.reset);

    if (opts.detail) {
      const filter = { property: 'Unit', relation: { contains: u.id } };
      const sorts  = [{ property: 'Date', direction: 'descending' }];
      process.stdout.write(`    ${C.grey}Loading ledger...${C.reset}`);
      const entries = await queryAll(DB.ledger, filter, sorts);
      console.log();
      const last5 = entries.slice(0, 5);
      if (last5.length > 0) {
        console.log(`    ${'─'.repeat(60)}`);
        for (const e of last5) {
          const eDate  = getDate(e, 'Date');
          const eType  = getSelect(e, 'Type').padEnd(22);
          const eDebit = getNumber(e, 'Debit')  || 0;
          const eCred  = getNumber(e, 'Credit') || 0;
          const eRef   = getText(e, 'Reference');
          const amt    = eDebit  > 0 ? `${C.red}-${fmt(eDebit)}${C.reset}`
                       : eCred   > 0 ? `${C.green}+${fmt(eCred)}${C.reset}` : '0';
          console.log(`    ${fmtDate(eDate)}  ${C.grey}${eType}${C.reset} ${amt}${eRef ? `  ref:${eRef}` : ''}`);
        }
        console.log(`    ${'─'.repeat(60)}`);
      }
    }
  }

  console.log('\n' + separator(W, '═'));
  console.log(`\n${C.bold}TOTAL OUTSTANDING: ${C.red}${fmtMoney(totalOwed)}${C.reset}`);
  console.log(`Delinquent units:  ${delinquent.length} of ${units.length}`);

  // Impact analysis
  process.stdout.write(`${C.grey}Fetching cash position...${C.reset}`);
  const cashAccts = await queryAll(DB.cashPosition);
  console.log();
  let availCash = 0;
  for (const acc of cashAccts) availCash += getNumber(acc, 'Current Balance') || 0;

  console.log(`\n${C.bold}📈 IMPACT ANALYSIS:${C.reset}`);
  console.log(`  Current cash position:       ${padL(fmtMoney(availCash), 22)}`);
  console.log(`  Outstanding receivables:     ${padL(fmtMoney(totalOwed), 22)}`);
  console.log(`  Cash if all owners current:  ${padL(fmtMoney(availCash - totalOwed), 22)}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: dashboard
// ═════════════════════════════════════════════════════════════════════════════

async function cmdDashboard(pos, opts) {
  const W = 62;
  console.log(`\n${boxTop(W)}`);
  console.log(boxLine(`🏢 ${(BUILDING.name || 'CONDO MANAGER OS').toUpperCase()} — DASHBOARD`, W));
  console.log(boxTop(W));
  console.log(` As of ${fmtDate(todayISO())} — Currency: ${CURRENCY}\n`);

  // ── Cash Position ───────────────────────────────────────────────────────────
  process.stdout.write(`${C.grey}Loading cash position...${C.reset}`);
  const cashAccts = await queryAll(DB.cashPosition);
  console.log();

  let totalCash = 0;
  console.log(`${C.bold}💰 CASH POSITION:${C.reset}`);
  for (const acc of cashAccts) {
    const name = getTitle(acc);
    const bal  = getNumber(acc, 'Current Balance') || 0;
    totalCash += bal;
    const icon = bal >= 0 ? '  ' : '⚠️';
    console.log(`  ${icon} ${padR(name + ':', 30)} ${padL(fmtMoney(bal), 18)}`);
  }
  console.log(`  ${'─'.repeat(52)}`);
  console.log(`     ${padR('TOTAL:', 30)} ${C.bold}${padL(fmtMoney(totalCash), 18)}${C.reset}`);

  // ── Unit Balances ────────────────────────────────────────────────────────
  process.stdout.write(`${C.grey}Loading units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log();

  let totalReceivables = 0;
  console.log(`\n${C.bold}🏠 UNIT BALANCES:${C.reset}`);
  const UW = [8, 22, 16, 14];
  const UH = ['Unit', 'Owner', 'Balance', 'Status'];
  console.log('  ' + tableRow(UH, UW));
  console.log('  ' + separator(UW));

  for (const u of units.sort((a,b) => getTitle(a).localeCompare(getTitle(b)))) {
    const uid    = getTitle(u);
    const owner  = getText(u, 'Owner Name').substring(0, 21);
    const bal    = getNumber(u, 'Current Balance') || 0;
    const status = getSelect(u, 'Fee Status');
    if (bal < 0) totalReceivables += bal;
    const icon = bal >= 0 ? '✅' : (bal > -20000 ? '🟡' : '🔴');
    console.log('  ' + tableRow([uid, owner, `${icon} ${fmt(bal)}`, status], UW));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const netPos    = totalCash + totalReceivables; // receivables are negative
  const netColor  = netPos >= 0 ? C.green : C.red;
  console.log(`\n${C.bold}📊 SUMMARY:${C.reset}`);
  console.log(`  Cash available:        ${padL(fmtMoney(totalCash), 22)}`);
  console.log(`  Total receivables:     ${padL(`${C.red}${fmtMoney(totalReceivables)}${C.reset}`, 22 + C.red.length + C.reset.length)}`);
  console.log(`  Net position:          ${padL(`${netColor}${C.bold}${fmtMoney(netPos)}${C.reset}`, 22 + netColor.length + C.bold.length + C.reset.length)}`);

  // ── Next fee call ──────────────────────────────────────────────────────────
  const freq  = BUILDING.feeFrequency || 'quarterly';
  const now   = new Date();
  const divisor = freq === 'quarterly' ? 4 : 12;
  let nextLabel, nextDateStr;

  if (freq === 'quarterly') {
    const q     = Math.floor(now.getMonth() / 3) + 1;
    const nextQ = q === 4 ? 1 : q + 1;
    const nextY = q === 4 ? now.getFullYear() + 1 : now.getFullYear();
    const qMon  = ['01','04','07','10'];
    nextLabel   = `Q${nextQ} ${nextY}`;
    nextDateStr = `${nextY}-${qMon[nextQ-1]}-01`;
  } else {
    const nextM  = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
    const nextY  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    nextLabel    = `${nextY}-${String(nextM+1).padStart(2,'0')}`;
    nextDateStr  = `${nextY}-${String(nextM+1).padStart(2,'0')}-01`;
  }

  const annualBudget  = BUILDING.annualBudget || 0;
  const nextCallTotal = units.reduce((sum, u) => {
    const pct = getNumber(u, 'Ownership Share (%)') || 0;
    return sum + (annualBudget * pct / 100 / divisor);
  }, 0);

  console.log(`\n${C.bold}📅 NEXT FEE CALL:${C.reset}`);
  console.log(`  Period:   ${nextLabel}`);
  console.log(`  Date:     ${fmtDate(nextDateStr)}`);
  console.log(`  Amount:   ${fmtMoney(Math.round(nextCallTotal))}`);
  console.log(`\n${boxTop(W)}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: close-year <year> [--total-expenses=xxx] [--confirm]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdCloseYear(pos, opts) {
  const year = parseInt(pos[1]);
  if (!year || year < 2000) {
    die('Usage: close-year <year> [--total-expenses=xxx] [--confirm]\n  Ex: close-year 2025 --total-expenses=955962 --confirm');
  }

  const isDryRun    = !opts.confirm;
  const totalExpArg = opts['total-expenses'] ? parseFloat(opts['total-expenses']) : null;

  const W = 62;
  console.log(`\n${boxTop(W)}`);
  console.log(boxLine(`YEAR-END CLOSING — ${year}`, W));
  console.log(boxTop(W));
  if (isDryRun) {
    console.log(`\n${C.yellow}⚠️  DRY RUN — add --confirm to write entries${C.reset}\n`);
  }

  // Get actual total expenses
  let totalExpenses = totalExpArg;
  if (!totalExpenses) {
    process.stdout.write(`${C.grey}Calculating expenses from DB...${C.reset}`);
    const expFilter = { property: 'Fiscal Year', number: { equals: year } };
    const expenses  = await queryAll(DB.expenses, expFilter);
    totalExpenses   = expenses.reduce((s, e) => s + (getNumber(e, 'Amount') || 0), 0);
    console.log(` ${fmtMoney(totalExpenses)}`);
  } else {
    console.log(`Total expenses (provided): ${fmtMoney(totalExpenses)}`);
  }

  // Fee calls per unit this year
  process.stdout.write(`${C.grey}Loading fee calls for ${year}...${C.reset}`);
  const fcFilter = {
    and: [
      { property: 'Fiscal Year', number: { equals: year } },
      { property: 'Type', select: { equals: 'Fee Call' } },
    ]
  };
  const feeCalls = await queryAll(DB.ledger, fcFilter);
  console.log(` ${feeCalls.length} fee call entries`);

  const fcByUnit = {};
  for (const e of feeCalls) {
    const ids = getRelationIds(e, 'Unit');
    if (ids.length > 0) fcByUnit[ids[0]] = (fcByUnit[ids[0]] || 0) + (getNumber(e, 'Debit') || 0);
  }

  process.stdout.write(`${C.grey}Loading units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log();

  const HW = [8, 22, 8, 14, 14, 16];
  const HH = ['Unit', 'Owner', 'Share%', 'Actual Share', 'Provisional', 'Adjustment'];
  console.log('\n' + tableRow(HH, HW));
  console.log(separator(HW));

  const adjustments = [];

  for (const unit of units) {
    const uid        = getTitle(unit);
    const owner      = getText(unit, 'Owner Name').substring(0, 21);
    const pct        = getNumber(unit, 'Ownership Share (%)') || 0;
    const curBalance = getNumber(unit, 'Current Balance') || 0;
    const actual     = Math.round(totalExpenses * pct / 100 * 100) / 100;
    const provisional= fcByUnit[unit.id] || 0;
    const adj        = Math.round((actual - provisional) * 100) / 100;

    const adjIcon = adj > 0.01 ? '📈' : (adj < -0.01 ? '💰' : '✅');
    const adjStr  = adj > 0.01 ? `+${fmt(adj)} ${adjIcon}`
                  : adj < -0.01 ? `${fmt(adj)} ${adjIcon}`
                  : `0 ${adjIcon}`;

    console.log(tableRow(
      [uid, owner, `${pct.toFixed(2)}%`, fmt(actual), fmt(provisional), adjStr],
      HW
    ));

    if (Math.abs(adj) > 0.01) {
      adjustments.push({ unit, uid, adj, curBalance, pct });
    }
  }

  console.log(separator(HW));
  console.log(`\nUnits requiring adjustment: ${adjustments.length}`);

  if (isDryRun) {
    console.log(`\n${C.yellow}Dry run complete — no entries written.${C.reset}`);
    console.log(`To apply: add ${C.bold}--confirm${C.reset} flag`);
    return;
  }

  console.log(`\n${C.bold}Writing adjustment entries...${C.reset}`);
  const closeDate = `${year}-12-31`;

  for (const { unit, uid, adj, curBalance } of adjustments) {
    const newBalance = Math.round((curBalance - adj) * 100) / 100;
    const entryProps = {
      'Entry':        prop.title(`${uid} — Year-End Adjustment ${year}`),
      'Unit':         prop.relation([unit.id]),
      'Date':         prop.date(closeDate),
      'Type':         prop.select('Year-End Closing Adjustment'),
      'Balance After':prop.number(newBalance),
      'Period':       prop.text(`Annual ${year}`),
      'Category':     prop.select('Common Charges'),
      'Fiscal Year':  prop.number(year),
    };
    if (adj > 0) entryProps['Debit']  = prop.number(adj);
    else         entryProps['Credit'] = prop.number(Math.abs(adj));

    await createPage(DB.ledger, entryProps);
    await updatePage(unit.id, {
      'Current Balance': prop.number(newBalance),
      'Fee Status':      prop.select(calcFeeStatus(newBalance, getDate(unit, 'Last Payment Date'))),
    });

    const dir = adj > 0
      ? `${C.red}+${fmt(adj)}${C.reset} (underpaid)`
      : `${C.green}${fmt(adj)}${C.reset} (credit)`;
    console.log(`  ${C.green}✓${C.reset} ${uid}: ${fmtMoney(curBalance)} → ${fmtMoney(newBalance)}  (${dir})`);  }

  console.log(`\n${C.green}✓ Year-end closing for ${year} complete!${C.reset}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: expense <description> <amount> [options]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdExpense(pos, opts) {
  const description = pos[1];
  const amount      = parseFloat(pos[2]);

  if (!description || isNaN(amount) || amount <= 0) {
    die('Usage: expense <description> <amount> [--category=xxx] [--vendor=xxx] [--account=xxx] [--date=xxx]\n  Ex: expense "INAPA Enero 2026" 3600 --category=Utilities --vendor=INAPA --account=banco');
  }

  const category   = opts.category || 'Uncategorized';
  const vendor     = opts.vendor   || '';
  const expDate    = toISO(opts.date) || todayISO();
  const accountInput = opts.account || '';
  const year       = new Date(expDate + 'T12:00:00Z').getFullYear();
  const qNum       = Math.floor(new Date(expDate + 'T12:00:00Z').getMonth() / 3) + 1;

  // Find cash account by partial match
  let cashAccount = null;
  if (accountInput) {
    process.stdout.write(`${C.grey}Finding account...${C.reset}`);
    const cashAccts = await queryAll(DB.cashPosition);
    console.log();
    const norm = accountInput.toLowerCase();
    cashAccount = cashAccts.find(a => getTitle(a).toLowerCase().includes(norm));
    if (!cashAccount) {
      const avail = cashAccts.map(a => getTitle(a)).join(', ');
      die(`Account '${accountInput}' not found.\nAvailable: ${avail}`);
    }
  }

  // Create Expenses entry
  process.stdout.write('Creating expense entry...');
  const expProps = {
    'Description': prop.title(description),
    'Amount':      prop.number(amount),
    'Date':        prop.date(expDate),
    'Category':    prop.select(category),
    'Status':      prop.select('Paid'),
    'Fiscal Year': prop.number(year),
    'Quarter':     prop.select(`Q${qNum}`),
  };
  if (vendor) expProps['Vendor'] = prop.text(vendor);

  await createPage(DB.expenses, expProps);
  console.log(' ✓');

  if (cashAccount) {
    const accName   = getTitle(cashAccount);
    const accBal    = getNumber(cashAccount, 'Current Balance') || 0;
    const newAccBal = Math.round((accBal - amount) * 100) / 100;

    // Create Account Movement (if DB configured)
    if (DB.movements) {
      process.stdout.write('Creating account movement...');
      await createPage(DB.movements, {
        'Description': prop.title(`Expense: ${description}`),
        'Amount':      prop.number(amount),
        'Date':        prop.date(expDate),
        'Type':        prop.select('Debit'),
        'Account':     prop.relation([cashAccount.id]),
      });
      console.log(' ✓');
    }

    // Update cash position
    process.stdout.write('Updating cash position...');
    await updatePage(cashAccount.id, {
      'Current Balance': prop.number(newAccBal),
      'Last Updated':    prop.date(expDate),
    });
    console.log(' ✓');

    console.log(`\n${C.green}✓ EXPENSE RECORDED${C.reset}`);
    console.log(`  Description: ${description}`);
    console.log(`  Amount:      ${C.bold}${fmtMoney(amount)}${C.reset}`);
    console.log(`  Category:    ${category}`);
    if (vendor) console.log(`  Vendor:      ${vendor}`);
    console.log(`  Account:     ${accName}`);
    console.log(`  Balance:     ${fmtMoney(accBal)} → ${newAccBal >= 0 ? C.green : C.red}${fmtMoney(newAccBal)}${C.reset}`);
  } else {
    console.log(`\n${C.green}✓ EXPENSE RECORDED${C.reset}`);
    console.log(`  Description: ${description}`);
    console.log(`  Amount:      ${C.bold}${fmtMoney(amount)}${C.reset}`);
    console.log(`  Category:    ${category}`);
    if (vendor) console.log(`  Vendor:      ${vendor}`);
    console.log(`  ${C.yellow}Note: No --account specified — cash position not updated.${C.reset}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: assessment <work-name> <total-amount> [options]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdAssessment(pos, opts) {
  const workName    = pos[1];
  const totalAmount = parseFloat(pos[2]);

  if (!workName || isNaN(totalAmount) || totalAmount <= 0) {
    die('Usage: assessment <work-name> <total-amount> [--vote-date=xxx] [--vote-type=AGM] [--date=xxx]\n  Ex: assessment "Roof Repair" 186000 --vote-type="Electronic Vote"');
  }

  const voteDate   = toISO(opts['vote-date']) || todayISO();
  const voteType   = opts['vote-type'] || 'AGM';
  const callDate   = toISO(opts.date) || todayISO();
  const year       = new Date(callDate + 'T12:00:00Z').getFullYear();

  console.log(`\n${C.bold}${C.cyan}📋 SPECIAL ASSESSMENT — ${workName}${C.reset}`);
  console.log(`Total Amount:  ${fmtMoney(totalAmount)}`);
  console.log(`Vote Type:     ${voteType} (${fmtDate(voteDate)})`);
  console.log(`Assessment Date: ${fmtDate(callDate)}\n`);

  // Create Works & Projects entry
  process.stdout.write('Creating works entry...');
  const workPage = await createPage(DB.works, {
    'Project':          prop.title(workName),
    'Quoted Amount':    prop.number(totalAmount),
    'Vote Date':        prop.date(voteDate),
    'Vote Type':        prop.select(voteType),
    'Status':           prop.select('Approved'),
    'Owner Assessment': prop.number(totalAmount),
  });
  console.log(' ✓');

  // Fetch units
  process.stdout.write(`${C.grey}Fetching units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log(` ${units.length} units`);

  const W = [8, 26, 9, 14, 14];
  const H = ['Unit', 'Owner', 'Share %', 'Assessment', 'New Balance'];
  console.log('\n' + tableRow(H, W));
  console.log(separator(W));

  const perUnitLines = [];
  let totalAssessed  = 0;

  for (const unit of units) {
    const uid        = getTitle(unit);
    const owner      = getText(unit, 'Owner Name');
    const ownership  = getNumber(unit, 'Ownership Share (%)') || 0;
    const curBalance = getNumber(unit, 'Current Balance') || 0;
    const unitAmt    = Math.round(totalAmount * ownership / 100 * 100) / 100;
    const newBalance = Math.round((curBalance - unitAmt) * 100) / 100;
    totalAssessed   += unitAmt;
    perUnitLines.push(`${uid}: ${fmt(unitAmt)}`);

    // Ledger entry
    await createPage(DB.ledger, {
      'Entry':         prop.title(`${uid} — Assessment: ${workName}`),
      'Unit':          prop.relation([unit.id]),
      'Date':          prop.date(callDate),
      'Type':          prop.select('Work Assessment'),
      'Debit':         prop.number(unitAmt),
      'Balance After': prop.number(newBalance),
      'Period':        prop.text(workName),
      'Category':      prop.select('Extraordinary Assessment'),
      'Fiscal Year':   prop.number(year),
    });

    // Update unit
    await updatePage(unit.id, {
      'Current Balance': prop.number(newBalance),
      'Fee Status':      prop.select(calcFeeStatus(newBalance, getDate(unit, 'Last Payment Date'))),
    });

    const flag = newBalance >= 0 ? '✅' : '⚠️ ';
    console.log(tableRow(
      [uid, owner.substring(0, 25), `${ownership.toFixed(2)}%`, fmt(unitAmt), `${flag} ${fmt(newBalance)}`],
      W
    ));
  }

  // Update works page with per-unit breakdown
  if (workPage && workPage.id) {
    await updatePage(workPage.id, {
      'Per-Unit Assessment': prop.text(perUnitLines.join(' / ')),
    });
  }

  console.log(separator(W, '═'));
  console.log(`\n${C.green}✓${C.reset} Assessment ${C.bold}${workName}${C.reset} created for ${units.length} units`);
  console.log(`  Total assessed: ${C.bold}${fmtMoney(totalAssessed)}${C.reset}`);
  console.log(`  Breakdown: ${perUnitLines.join(' | ')}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// HELP
// ═════════════════════════════════════════════════════════════════════════════

function showHelp() {
  const bname   = BUILDING.name     || 'Your Building';
  const freq    = BUILDING.feeFrequency || 'quarterly';
  const budget  = fmtMoney(BUILDING.annualBudget || 0);

  console.log(`
${C.bold}${C.cyan}🏢 CONDO MANAGER OS v3.0 — ${bname}${C.reset}
${'═'.repeat(56)}
${C.grey}Building: ${bname} | Currency: ${CURRENCY} | Frequency: ${freq}
Annual Budget: ${budget}${C.reset}
${'─'.repeat(56)}

${C.bold}USAGE:${C.reset}  node condo-cli.js <command> [options]

${C.bold}COMMANDS:${C.reset}

  ${C.cyan}fee-call${C.reset} <Q1|Q2|Q3|Q4|YYYY-MM> [year]
    Issue fee calls to all units based on ownership share.
    ${C.grey}Ex: node condo-cli.js fee-call Q2 2026
    Ex: node condo-cli.js fee-call 2026-01${C.reset}

  ${C.cyan}payment${C.reset} <unit> <amount> [options]
    Record a payment from an owner and update balance.
    Options: --method=transfer --ref=7821 --date=YYYY-MM-DD
    ${C.grey}Ex: node condo-cli.js payment A-3 25000 --method=transfer --ref=7821${C.reset}

  ${C.cyan}statement${C.reset} <unit> [options]
    Generate detailed account statement for a unit.
    Options: --from=YYYY-MM-DD --to=YYYY-MM-DD --lang=en|es|fr
    ${C.grey}Ex: node condo-cli.js statement A-5
    Ex: node condo-cli.js statement A-1 --from=2025-01-01 --to=2025-12-31 --lang=fr${C.reset}

  ${C.cyan}report${C.reset} [monthly|quarterly] <period>
    Financial report: income, expenses vs budget, cash position, delinquency.
    ${C.grey}Ex: node condo-cli.js report monthly 2026-01
    Ex: node condo-cli.js report quarterly Q1-2026${C.reset}

  ${C.cyan}delinquency${C.reset} [--detail]
    List delinquent units with balances and impact analysis.
    --detail shows last 5 ledger entries per unit.
    ${C.grey}Ex: node condo-cli.js delinquency --detail${C.reset}

  ${C.cyan}dashboard${C.reset}
    Quick overview: cash position, all unit balances, next fee call.
    ${C.grey}Ex: node condo-cli.js dashboard${C.reset}

  ${C.cyan}close-year${C.reset} <year> [--total-expenses=xxx] [--confirm]
    Year-end reconciliation: actual vs provisional charges.
    Dry-run by default. Add --confirm to write entries.
    ${C.grey}Ex: node condo-cli.js close-year 2025 --total-expenses=955962 --confirm${C.reset}

  ${C.cyan}expense${C.reset} <description> <amount> [options]
    Record an expense and update cash position account.
    Options: --category=xxx --vendor=xxx --account=banco --date=xxx
    ${C.grey}Ex: node condo-cli.js expense "INAPA Enero 2026" 3600 --category=Utilities --vendor=INAPA --account=banco${C.reset}

  ${C.cyan}assessment${C.reset} <work-name> <total-amount> [options]
    Special assessment for voted works, distributed by ownership %.
    Options: --vote-date=xxx --vote-type="Electronic Vote" --date=xxx
    ${C.grey}Ex: node condo-cli.js assessment "Roof Repair" 186000 --vote-type="Electronic Vote"${C.reset}

${'─'.repeat(56)}
${C.grey}Unit matching is case-insensitive: "a1" = "A1" = "A-1"
Set DEBUG=1 for full error stack traces.${C.reset}
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Error helper
// ─────────────────────────────────────────────────────────────────────────────

function die(msg) {
  console.error(`\n${C.red}✗  ${msg}${C.reset}\n`);
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN DISPATCHER
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  const { pos, opts } = parseCli(process.argv);
  const command       = pos[0];

  if (!command || command === 'help' || opts.help || opts.h) {
    showHelp();
    return;
  }

  try {
    switch (command.toLowerCase()) {
      case 'fee-call':
      case 'feecall':
      case 'fee_call':
        await cmdFeeCall(pos, opts);
        break;
      case 'payment':
      case 'pay':
        await cmdPayment(pos, opts);
        break;
      case 'statement':
      case 'stmt':
        await cmdStatement(pos, opts);
        break;
      case 'report':
        await cmdReport(pos, opts);
        break;
      case 'delinquency':
      case 'delinquent':
      case 'delq':
        await cmdDelinquency(pos, opts);
        break;
      case 'dashboard':
      case 'dash':
        await cmdDashboard(pos, opts);
        break;
      case 'close-year':
      case 'closeyear':
      case 'close_year':
        await cmdCloseYear(pos, opts);
        break;
      case 'expense':
      case 'exp':
        await cmdExpense(pos, opts);
        break;
      case 'assessment':
      case 'assess':
        await cmdAssessment(pos, opts);
        break;
      default:
        console.error(`${C.red}✗  Unknown command: '${command}'${C.reset}`);
        console.error(`   Run ${C.bold}node condo-cli.js --help${C.reset} to see available commands.`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n${C.red}✗  ${err.message}${C.reset}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    } else {
      console.error(`   ${C.grey}Set DEBUG=1 for full stack trace.${C.reset}`);
    }
    process.exit(1);
  }
}

main();
