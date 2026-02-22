#!/usr/bin/env node
// =============================================================================
// Condo Manager OS v3.2 — Main CLI
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
// i18n Labels (statement + reminder commands)
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
// COMMAND: late-fees [--rate=0.02] [--grace=15] [--confirm]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdLateFees(pos, opts) {
  const rate      = parseFloat(opts.rate  || '0.02');
  const grace     = parseInt(opts.grace   || '15', 10);
  const isDryRun  = !opts.confirm;
  const today     = todayISO();
  const msPerDay  = 86400000;

  console.log(`\n${C.bold}${C.cyan}💸 LATE FEE CALCULATION${C.reset}`);
  console.log(`Rate: ${(rate * 100).toFixed(2)}%  |  Grace Period: ${grace} days  |  As of: ${fmtDate(today)}`);
  if (isDryRun) console.log(`\n${C.yellow}⚠️  DRY RUN — add --confirm to apply fees${C.reset}\n`);
  else console.log();

  process.stdout.write(`${C.grey}Fetching units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log(` ${units.length} found`);

  const overdue = units.filter(u => (getNumber(u, 'Current Balance') || 0) < 0);
  if (overdue.length === 0) {
    console.log(`\n${C.green}✅ No units with negative balance — no late fees to apply.${C.reset}`);
    return;
  }

  const W = [8, 16, 14, 14, 12];
  const H = ['Unit', 'Owner', 'Balance', 'Days Overdue', 'Late Fee'];
  console.log('\n' + tableRow(H, W));
  console.log(separator(W));

  const toApply = [];

  for (const unit of overdue) {
    const uid      = getTitle(unit);
    const owner    = getText(unit, 'Owner Name').substring(0, 15);
    const balance  = getNumber(unit, 'Current Balance') || 0;
    const lastPay  = getDate(unit, 'Last Payment Date');
    const refDate  = lastPay || today;
    const daysOver = Math.floor((Date.now() - new Date(refDate + 'T12:00:00Z')) / msPerDay);

    if (daysOver <= grace) {
      console.log(tableRow([uid, owner, fmt(balance), `${daysOver} (within grace)`, '—'], W));
      continue;
    }

    const fee = Math.round(Math.abs(balance) * rate * 100) / 100;
    const flag = daysOver > 90 ? `${C.red}` : (daysOver > 60 ? `${C.yellow}` : '');
    console.log(flag + tableRow([uid, owner, fmt(balance), String(daysOver), fmt(fee)], W) + C.reset);
    toApply.push({ unit, uid, balance, daysOver, fee });
  }

  console.log(separator(W, '═'));
  const totalFees = toApply.reduce((s, x) => s + x.fee, 0);
  console.log(`\nUnits subject to late fee: ${toApply.length}  |  Total: ${C.bold}${fmtMoney(totalFees)}${C.reset}`);

  if (isDryRun) {
    console.log(`\n${C.yellow}Dry run complete. Use --confirm to create ledger entries.${C.reset}`);
    return;
  }

  if (toApply.length === 0) {
    console.log(`\n${C.green}No fees to apply.${C.reset}`);
    return;
  }

  console.log(`\n${C.bold}Applying late fees...${C.reset}`);
  for (const { unit, uid, balance, fee } of toApply) {
    const newBalance = Math.round((balance - fee) * 100) / 100;
    await createPage(DB.ledger, {
      'Entry':         prop.title(`${uid} — Late Fee ${today}`),
      'Unit':          prop.relation([unit.id]),
      'Date':          prop.date(today),
      'Type':          prop.select('Late Fee'),
      'Debit':         prop.number(fee),
      'Balance After': prop.number(newBalance),
      'Category':      prop.select('Penalties & Fees'),
      'Period':        prop.text(today.slice(0, 7)),
    });
    await updatePage(unit.id, {
      'Current Balance': prop.number(newBalance),
      'Fee Status':      prop.select(calcFeeStatus(newBalance, getDate(unit, 'Last Payment Date'))),
    });
    console.log(`  ${C.green}✓${C.reset} ${uid}: fee ${fmtMoney(fee)} → new balance ${fmtMoney(newBalance)}`);
  }

  console.log(`\n${C.green}✓ Late fees applied to ${toApply.length} units.${C.reset}  Total: ${C.bold}${fmtMoney(totalFees)}${C.reset}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: reminder [--level=1] [--unit=X] [--all-overdue] [--lang=es|en|fr]
// ═════════════════════════════════════════════════════════════════════════════

const REMINDER_L10N = {
  en: {
    subj: [
      null,
      'Reminder — {period} Charges for Unit {unit}',
      'FORMAL NOTICE — Overdue Charges for Unit {unit}',
      'FINAL WARNING — Urgent: Unpaid Charges Unit {unit}',
      'NOTICE OF INTENT — Legal Proceedings — Unit {unit}',
    ],
    dear:     'Dear {owner},',
    body: [
      null,
      // Level 1
      `This is a friendly reminder that your common charges of {amount} {currency} for Unit {unit} appear as unpaid in our records.

Your current balance: {balance} {currency}

If you have recently made the payment, please send us confirmation (transfer receipt or reference number) and we will update your account.

Payment deadline: {deadline}

{bankDetails}

Thank you for your attention.`,
      // Level 2
      `We wish to inform you that the following charges for Unit {unit} remain unpaid as of {today}:

Amount due: {amount} {currency}
Days overdue: {daysOver}
Current balance: {balance} {currency}

Per the condominium regulations, late payments may incur:
  • Late fees as established in the building rules
  • Restriction of access to common amenities
  • Legal proceedings for recovery

We kindly request immediate payment or, if you are experiencing financial difficulty, contact us to discuss a payment arrangement.

Payment deadline: {deadline}

{bankDetails}`,
      // Level 3
      `Despite our previous communications, the following amounts remain outstanding for Unit {unit}:

Total outstanding: {balance} {currency}
Days overdue: {daysOver}

This debt directly impacts the condominium's ability to pay contractors for essential maintenance, cover insurance premiums, and maintain common areas.

If full payment or a formal payment agreement is not received by {deadline}, the Board will be compelled to pursue legal remedies.

This is our final attempt at an amicable resolution.`,
      // Level 4
      `Ref: Outstanding condominium charges — {balance} {currency}

You are hereby formally notified that the Board has authorized the engagement of legal counsel to pursue recovery of the outstanding amount of {balance} {currency} owed by Unit {unit}.

Days overdue: {daysOver}

Unless full payment is received within 15 calendar days of this notice, legal proceedings will be initiated without further notice. All legal costs and fees will be charged to the debtor's account.`,
    ],
    closing: 'Best regards,\n{building} Administration\n{today}',
    levelNames: ['', 'Friendly Reminder', 'Formal Notice', 'Final Warning', 'Pre-Legal Notice'],
  },
  es: {
    subj: [
      null,
      'Recordatorio — Cargos {period} Unidad {unit}',
      'AVISO FORMAL — Cargos Vencidos Unidad {unit}',
      'ADVERTENCIA FINAL — Urgente: Cargos Impagos Unidad {unit}',
      'AVISO DE INTENCIÓN — Proceso Legal — Unidad {unit}',
    ],
    dear:     'Estimado/a {owner},',
    body: [
      null,
      // Level 1
      `Le recordamos cordialmente que los cargos de cuota de {amount} {currency} para la Unidad {unit} aparecen como pendientes en nuestros registros.

Saldo actual: {balance} {currency}

Si ya realizó el pago, le agradecemos que nos envíe el comprobante de transferencia o el número de referencia para actualizar su cuenta.

Fecha límite de pago: {deadline}

{bankDetails}

Gracias por su atención.`,
      // Level 2
      `Le informamos que los siguientes cargos para la Unidad {unit} continúan sin pagar al {today}:

Monto adeudado: {amount} {currency}
Días de atraso: {daysOver}
Saldo actual: {balance} {currency}

Según el reglamento del condominio, los pagos atrasados pueden incurrir en:
  • Cargos por mora
  • Restricción de acceso a áreas comunes
  • Acciones legales para recuperación

Le solicitamos pago inmediato o, si enfrenta dificultades económicas, que se comunique con nosotros para acordar un plan de pago.

Fecha límite: {deadline}

{bankDetails}`,
      // Level 3
      `A pesar de nuestras comunicaciones anteriores, los siguientes montos continúan pendientes para la Unidad {unit}:

Total adeudado: {balance} {currency}
Días de atraso: {daysOver}

Esta deuda afecta directamente la capacidad del condominio para pagar a los contratistas, cubrir primas de seguro y mantener las áreas comunes.

Si no se recibe el pago completo o un acuerdo formal antes del {deadline}, la Junta se verá obligada a iniciar los recursos legales disponibles.

Este es nuestro último intento de resolución amistosa.`,
      // Level 4
      `Ref: Cargos de condominio pendientes — {balance} {currency}

Por medio de la presente, se le notifica formalmente que la Junta ha autorizado al asesor legal para gestionar el cobro del monto de {balance} {currency} adeudado por la Unidad {unit}.

Días de atraso: {daysOver}

A menos que se reciba el pago completo dentro de los 15 días calendario siguientes a este aviso, se iniciarán los procedimientos legales sin previo aviso adicional.`,
    ],
    closing: 'Atentamente,\nAdministración {building}\n{today}',
    levelNames: ['', 'Recordatorio Amistoso', 'Aviso Formal', 'Advertencia Final', 'Aviso Pre-Legal'],
  },
  fr: {
    subj: [
      null,
      'Rappel — Charges {period} Appartement {unit}',
      'AVIS FORMEL — Charges impayées Appartement {unit}',
      'DERNIER AVERTISSEMENT — Urgent : Charges impayées Appartement {unit}',
      'MISE EN DEMEURE — Procédure légale — Appartement {unit}',
    ],
    dear:     'Madame, Monsieur {owner},',
    body: [
      null,
      // Level 1
      `Nous vous rappelons cordialement que les charges de copropriété de {amount} {currency} pour l'appartement {unit} apparaissent comme impayées dans nos registres.

Solde actuel : {balance} {currency}

Si vous avez effectué le paiement récemment, nous vous prions de nous envoyer la confirmation (preuve de virement ou numéro de référence) afin de mettre à jour votre compte.

Date limite de paiement : {deadline}

{bankDetails}

Nous vous remercions de votre attention.`,
      // Level 2
      `Nous vous informons que les charges suivantes pour l'appartement {unit} restent impayées au {today} :

Montant dû : {amount} {currency}
Jours de retard : {daysOver}
Solde actuel : {balance} {currency}

Conformément au règlement de copropriété, les retards de paiement peuvent entraîner :
  • Des pénalités de retard
  • La restriction d'accès aux équipements communs
  • Des procédures judiciaires de recouvrement

Nous vous demandons de procéder au règlement immédiat ou, en cas de difficultés financières, de nous contacter pour convenir d'un arrangement.

Date limite : {deadline}

{bankDetails}`,
      // Level 3
      `Malgré nos communications précédentes, les montants suivants restent dus pour l'appartement {unit} :

Total dû : {balance} {currency}
Jours de retard : {daysOver}

Cette dette impacte directement la capacité de la copropriété à régler les entrepreneurs, couvrir les primes d'assurance et entretenir les parties communes.

Sans règlement complet ou accord formel avant le {deadline}, le Conseil sera contraint d'engager les recours légaux disponibles.

Il s'agit de notre dernière tentative de résolution amiable.`,
      // Level 4
      `Objet : Charges de copropriété impayées — {balance} {currency}

Vous êtes par la présente formellement notifié(e) que le Conseil a autorisé le recours à un conseil juridique pour le recouvrement du montant de {balance} {currency} dû par l'appartement {unit}.

Jours de retard : {daysOver}

Sans règlement intégral dans les 15 jours calendaires suivant le présent avis, une procédure judiciaire sera engagée sans notification supplémentaire.`,
    ],
    closing: 'Cordialement,\nAdministration {building}\n{today}',
    levelNames: ['', 'Rappel amical', 'Avis formel', 'Dernier avertissement', 'Mise en demeure'],
  },
};

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

async function cmdReminder(pos, opts) {
  const level     = Math.min(4, Math.max(1, parseInt(opts.level || '1', 10)));
  const lang      = (opts.lang || 'es').toLowerCase();
  const RL        = REMINDER_L10N[lang] || REMINDER_L10N.es;
  const today     = todayISO();
  const deadline  = (() => {
    const d = new Date(today + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 15);
    return fmtDate(d.toISOString().slice(0, 10));
  })();
  const msPerDay  = 86400000;
  const bankDetails = (BUILDING.bankDetails || '').replace(/\\n/g, '\n');

  process.stdout.write(`${C.grey}Fetching units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log(` ${units.length} found`);

  let targets;

  if (opts.unit) {
    const found = matchUnit(units, opts.unit);
    if (!found) die(`Unit '${opts.unit}' not found.`);
    targets = [found];
  } else if (opts['all-overdue']) {
    targets = units.filter(u => (getNumber(u, 'Current Balance') || 0) < 0);
    if (targets.length === 0) {
      console.log(`\n${C.green}✅ No overdue units.${C.reset}`);
      return;
    }
  } else {
    die('Usage: reminder [--level=1] [--unit=X | --all-overdue] [--lang=es|en|fr]');
  }

  console.log(`\n${C.bold}${C.cyan}📨 PAYMENT REMINDERS — ${RL.levelNames[level]}${C.reset}`);
  console.log(`Language: ${lang.toUpperCase()}  |  Level: ${level}  |  Generating for ${targets.length} unit(s)\n`);

  for (const unit of targets) {
    const uid      = getTitle(unit);
    const owner    = getText(unit, 'Owner Name');
    const email    = getText(unit, 'Owner Email');
    const balance  = getNumber(unit, 'Current Balance') || 0;
    const lastPay  = getDate(unit, 'Last Payment Date');
    const refDate  = lastPay || today;
    const daysOver = Math.floor((Date.now() - new Date(refDate + 'T12:00:00Z')) / msPerDay);
    const period   = `${new Date().getFullYear()}`;

    const vars = {
      unit:     uid,
      owner,
      amount:   fmt(Math.abs(balance)),
      balance:  fmt(balance),
      currency: CURRENCY,
      daysOver: String(daysOver),
      today:    fmtDate(today),
      deadline,
      period,
      building: BUILDING.name || 'Building Administration',
      bankDetails: bankDetails || '[Bank details — see config.building.bankDetails]',
    };

    const subject = fillTemplate(RL.subj[level], vars);
    const body    = fillTemplate(RL.body[level], vars);
    const closing = fillTemplate(RL.closing, vars);

    const line = '─'.repeat(70);
    console.log(line);
    console.log(`${C.bold}Unit:${C.reset}    ${uid}  |  ${C.bold}Owner:${C.reset} ${owner}  |  ${C.bold}Email:${C.reset} ${email || '—'}`);
    console.log(`${C.bold}Balance:${C.reset} ${C.red}${fmtMoney(balance)}${C.reset}  |  Days overdue: ${daysOver}`);
    console.log(line);
    console.log(`${C.bold}Subject:${C.reset} ${subject}`);
    console.log();
    console.log(RL.dear.replace('{owner}', owner));
    console.log();
    console.log(body);
    console.log();
    console.log(closing);
    console.log();

    // Log to Communications DB
    if (DB.communications) {
      await createPage(DB.communications, {
        'Subject':   prop.title(subject),
        'Unit':      prop.relation([unit.id]),
        'Type':      prop.select('Payment Reminder'),
        'Channel':   prop.select('Email'),
        'Date':      prop.date(today),
        'Direction': prop.select('Sent'),
        'Content':   prop.text(`Level ${level} — ${body.substring(0, 1800)}`),
      });
    }
  }

  console.log('─'.repeat(70));
  console.log(`\n${C.green}✓ ${targets.length} reminder(s) generated (Level ${level} — ${RL.levelNames[level]}).${C.reset}`);
  if (DB.communications) console.log(`  ${C.grey}Logged to Communications DB.${C.reset}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: reserve-projection [--years=5] [--annual-contribution=X] [--rate=0.03]
// ═════════════════════════════════════════════════════════════════════════════

async function cmdReserveProjection(pos, opts) {
  const years            = parseInt(opts.years || '5', 10);
  const interestRate     = parseFloat(opts.rate || '0.03');
  let   annualContrib    = opts['annual-contribution'] ? parseFloat(opts['annual-contribution']) : null;

  // Find Reserve Fund account in cash position
  process.stdout.write(`${C.grey}Fetching cash position...${C.reset}`);
  const cashAccts = await queryAll(DB.cashPosition);
  console.log(` ${cashAccts.length} accounts`);

  const reserveAcct = cashAccts.find(a => {
    const name = getTitle(a).toLowerCase();
    return name.includes('reserve') || name.includes('reserv') || name.includes('fondo');
  });

  let openingBalance = 0;
  if (reserveAcct) {
    openingBalance = getNumber(reserveAcct, 'Current Balance') || 0;
    console.log(`Reserve Fund account: ${C.bold}${getTitle(reserveAcct)}${C.reset} — ${fmtMoney(openingBalance)}`);
  } else {
    console.log(`${C.yellow}⚠️  No Reserve Fund account found in Cash Position. Starting from 0.${C.reset}`);
  }

  // Default contribution: use annual budget fraction if not provided
  if (!annualContrib) {
    annualContrib = BUILDING.annualBudget ? Math.round(BUILDING.annualBudget * 0.1) : 0;
    if (annualContrib > 0) {
      console.log(`${C.grey}Using 10% of annual budget as default contribution: ${fmtMoney(annualContrib)}${C.reset}`);
    } else {
      console.log(`${C.yellow}⚠️  No --annual-contribution specified and no budget found. Contribution = 0.${C.reset}`);
    }
  }

  // Planned works withdrawals: query works DB for planned/in-progress
  const plannedWithdrawals = {};
  if (DB.works) {
    process.stdout.write(`${C.grey}Fetching planned works...${C.reset}`);
    const worksFilter = {
      or: [
        { property: 'Status', select: { equals: 'Approved' } },
        { property: 'Status', select: { equals: 'Contractor Selected' } },
        { property: 'Status', select: { equals: 'In Progress' } },
      ]
    };
    const works = await queryAll(DB.works, worksFilter);
    console.log(` ${works.length} planned/active`);
    for (const w of works) {
      const remaining = getNumber(w, 'Remaining') || getNumber(w, 'Quoted Amount') || 0;
      if (remaining > 0) {
        const yr = new Date().getFullYear(); // default current year
        plannedWithdrawals[yr] = (plannedWithdrawals[yr] || 0) + remaining;
      }
    }
  }

  const startYear = new Date().getFullYear();
  const W = [6, 14, 14, 12, 14, 14];
  const H = ['Year', 'Opening', 'Contribution', 'Interest', 'Withdrawals', 'Closing'];
  const LABEL = `RESERVE FUND PROJECTION (${years} years)`;

  console.log(`\n${boxTop(70)}`);
  console.log(boxLine(LABEL, 70));
  console.log(boxTop(70));
  console.log(`Interest rate: ${(interestRate * 100).toFixed(1)}%/year  |  Annual contribution: ${fmtMoney(annualContrib)}\n`);
  console.log(tableRow(H, W));
  console.log(separator(W));

  let balance    = openingBalance;
  let warnYears  = [];

  for (let i = 0; i < years; i++) {
    const yr           = startYear + i;
    const opening      = balance;
    const contribution = annualContrib;
    const interest     = i === 0 ? 0 : Math.round(opening * interestRate * 100) / 100;
    const withdrawals  = plannedWithdrawals[yr] || 0;
    const closing      = Math.round((opening + contribution + interest - withdrawals) * 100) / 100;

    if (closing < 0) warnYears.push(yr);

    const closingStr = closing < 0 ? `${C.red}${fmt(closing)}${C.reset}` : fmt(closing);
    console.log(tableRow(
      [String(yr), fmt(opening), fmt(contribution), fmt(interest), fmt(withdrawals), closing < 0 ? `⚠️  ${fmt(closing)}` : fmt(closing)],
      W
    ));

    balance = closing;
  }

  console.log(separator(W, '═'));
  console.log(`\n  Final balance (${startYear + years - 1}): ${C.bold}${fmtMoney(balance)}${C.reset}`);

  if (warnYears.length > 0) {
    console.log(`\n${C.red}⚠️  WARNING: Projected balance goes NEGATIVE in: ${warnYears.join(', ')}${C.reset}`);
    console.log(`   Consider increasing annual contributions or deferring planned works.`);
  } else {
    console.log(`\n${C.green}✅ Reserve fund remains positive throughout the ${years}-year projection.${C.reset}`);
  }
  console.log();
}

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND: agm-prep [year] [--date=YYYY-MM-DD] [--lang=es|en|fr]
// ═════════════════════════════════════════════════════════════════════════════

const AGM_L10N = {
  en: {
    title:   'ANNUAL GENERAL MEETING PREPARATION PACKAGE',
    agenda:  'DRAFT AGENDA',
    items: [
      'Roll call & quorum verification',
      'Approval of previous meeting minutes',
      'Financial report {year}',
      'Budget proposal {nextYear}',
      'Delinquency report & collection actions',
      'Works completed & planned',
      'Election of board members',
      'Any other business',
    ],
    quorum:  'QUORUM REQUIREMENT',
    financials: 'FINANCIAL SUMMARY {year}',
    delinquency: 'DELINQUENCY SUMMARY',
    cashPos:   'CASH POSITION',
    works:     'WORKS SUMMARY',
    shares:    'VOTING SHARES PER UNIT',
    notice:    'NOTICE TO OWNERS',
    subject:   'Notice of Annual General Meeting — {building} — {year}',
    noticeBody: `Dear Co-owners,

You are hereby invited to the Annual General Meeting of {building} to be held on:

Date: {date}
Location: {location}

The meeting will address the following agenda items:

{agenda}

The quorum requires the presence of co-owners representing more than 50% of voting shares.

Please confirm your attendance or submit a proxy form to administration.

{building} Administration
{today}`,
    income:    'Total Income',
    expenses:  'Total Expenses',
    netResult: 'Net Result',
    budget:    'Approved Budget',
    variance:  'Variance',
  },
  es: {
    title:   'PAQUETE DE PREPARACIÓN — ASAMBLEA GENERAL ANUAL',
    agenda:  'AGENDA PRELIMINAR',
    items: [
      'Llamado a lista y verificación del quórum',
      'Aprobación del acta de la asamblea anterior',
      'Informe financiero {year}',
      'Presupuesto propuesto {nextYear}',
      'Informe de morosidad y acciones de cobro',
      'Obras realizadas y planificadas',
      'Elección de miembros de la Junta Directiva',
      'Asuntos varios',
    ],
    quorum:  'REQUISITO DE QUÓRUM',
    financials: 'RESUMEN FINANCIERO {year}',
    delinquency: 'RESUMEN DE MOROSIDAD',
    cashPos:   'POSICIÓN DE CAJA',
    works:     'RESUMEN DE OBRAS',
    shares:    'PORCENTAJE DE PARTICIPACIÓN POR UNIDAD',
    notice:    'CONVOCATORIA A PROPIETARIOS',
    subject:   'Convocatoria Asamblea General — {building} — {year}',
    noticeBody: `Estimados Copropietarios,

Por medio de la presente, les convocamos a la Asamblea General Anual de {building} a celebrarse:

Fecha: {date}
Lugar: {location}

La asamblea tratará los siguientes puntos del orden del día:

{agenda}

El quórum requiere la presencia de copropietarios que representen más del 50% de las participaciones con derecho a voto.

Por favor confirme su asistencia o entregue un poder notarial a la administración.

Administración {building}
{today}`,
    income:    'Ingresos Totales',
    expenses:  'Gastos Totales',
    netResult: 'Resultado Neto',
    budget:    'Presupuesto Aprobado',
    variance:  'Variación',
  },
  fr: {
    title:   "DOSSIER DE PRÉPARATION — ASSEMBLÉE GÉNÉRALE ANNUELLE",
    agenda:  "ORDRE DU JOUR PROVISOIRE",
    items: [
      "Appel et vérification du quorum",
      "Approbation du procès-verbal de l'assemblée précédente",
      "Rapport financier {year}",
      "Proposition de budget {nextYear}",
      "Rapport de recouvrement et actions envers les copropriétaires défaillants",
      "Travaux réalisés et planifiés",
      "Élection des membres du Conseil Syndical",
      "Questions diverses",
    ],
    quorum:  'EXIGENCE DE QUORUM',
    financials: 'RÉSUMÉ FINANCIER {year}',
    delinquency: 'RÉSUMÉ DES IMPAYÉS',
    cashPos:   'POSITION DE TRÉSORERIE',
    works:     'RÉSUMÉ DES TRAVAUX',
    shares:    'TANTIÈMES PAR LOT',
    notice:    'CONVOCATION AUX PROPRIÉTAIRES',
    subject:   "Convocation à l'Assemblée Générale — {building} — {year}",
    noticeBody: `Madame, Monsieur,

Vous êtes convoqué(e) à l'Assemblée Générale Annuelle de {building} qui se tiendra le :

Date : {date}
Lieu : {location}

L'assemblée traitera les points suivants à l'ordre du jour :

{agenda}

Le quorum requiert la présence de copropriétaires représentant plus de 50 % des tantièmes.

Veuillez confirmer votre présence ou remettre une procuration à l'administration.

Administration {building}
{today}`,
    income:    'Revenus Totaux',
    expenses:  'Dépenses Totales',
    netResult: 'Résultat Net',
    budget:    'Budget Approuvé',
    variance:  'Écart',
  },
};

async function cmdAgmPrep(pos, opts) {
  const year     = parseInt(pos[1] || String(new Date().getFullYear()), 10);
  const nextYear = year + 1;
  const lang     = (opts.lang || 'es').toLowerCase();
  const AL       = AGM_L10N[lang] || AGM_L10N.es;
  const today    = todayISO();
  const meetDate = opts.date ? fmtDate(toISO(opts.date)) : '[DATE TO BE CONFIRMED]';
  const location = BUILDING.address || '[Location to be confirmed]';
  const W        = 72;

  console.log(`\n${'═'.repeat(W)}`);
  console.log(boxLine(AL.title, W));
  console.log(boxLine(`${BUILDING.name || 'Building'} — ${year}`, W));
  console.log(`${'═'.repeat(W)}`);
  console.log(` Prepared: ${fmtDate(today)}  |  Language: ${lang.toUpperCase()}\n`);

  // ── Financial data ─────────────────────────────────────────────────────────
  console.log(`${C.bold}[1/6] ${AL.financials.replace('{year}', year)}${C.reset}`);
  process.stdout.write(`    ${C.grey}Loading ledger...${C.reset}`);
  const yearFilter = {
    and: [
      { property: 'Date', date: { on_or_after:  `${year}-01-01` } },
      { property: 'Date', date: { on_or_before: `${year}-12-31` } },
    ]
  };
  const ledger = await queryAll(DB.ledger, yearFilter);
  console.log(` ${ledger.length} entries`);

  let totalIncome = 0, totalFeeCalls = 0;
  for (const e of ledger) {
    const t = getSelect(e, 'Type');
    if (t === 'Payment Received') totalIncome    += getNumber(e, 'Credit') || 0;
    if (t === 'Fee Call')         totalFeeCalls  += getNumber(e, 'Debit')  || 0;
  }

  process.stdout.write(`    ${C.grey}Loading expenses...${C.reset}`);
  const expFilter = {
    and: [
      { property: 'Date', date: { on_or_after:  `${year}-01-01` } },
      { property: 'Date', date: { on_or_before: `${year}-12-31` } },
    ]
  };
  const expenses = await queryAll(DB.expenses, expFilter);
  console.log(` ${expenses.length} entries`);

  const totalExpenses = expenses.reduce((s, e) => s + (getNumber(e, 'Amount') || 0), 0);
  const netResult     = totalIncome - totalExpenses;
  const annualBudget  = BUILDING.annualBudget || 0;

  console.log(`    ${padR(AL.income + ':', 28)} ${fmtMoney(totalIncome)}`);
  console.log(`    ${padR(AL.expenses + ':', 28)} ${fmtMoney(totalExpenses)}`);
  console.log(`    ${padR(AL.netResult + ':', 28)} ${(netResult >= 0 ? C.green : C.red)}${fmtMoney(netResult)}${C.reset}`);
  console.log(`    ${padR(AL.budget + ':', 28)} ${fmtMoney(annualBudget)}`);
  const variance = totalExpenses - annualBudget;
  console.log(`    ${padR(AL.variance + ':', 28)} ${(variance <= 0 ? C.green : C.red)}${fmtMoney(variance)}${C.reset}`);
  console.log();

  // ── Cash position ──────────────────────────────────────────────────────────
  console.log(`${C.bold}[2/6] ${AL.cashPos}${C.reset}`);
  process.stdout.write(`    ${C.grey}Loading cash position...${C.reset}`);
  const cashAccts = await queryAll(DB.cashPosition);
  console.log();
  let totalCash = 0;
  for (const acc of cashAccts) {
    const name = getTitle(acc);
    const bal  = getNumber(acc, 'Current Balance') || 0;
    totalCash += bal;
    console.log(`    ${padR(name + ':', 32)} ${fmtMoney(bal)}`);
  }
  console.log(`    ${'─'.repeat(44)}`);
  console.log(`    ${padR('TOTAL:', 32)} ${C.bold}${fmtMoney(totalCash)}${C.reset}`);
  console.log();

  // ── Delinquency ────────────────────────────────────────────────────────────
  console.log(`${C.bold}[3/6] ${AL.delinquency}${C.reset}`);
  process.stdout.write(`    ${C.grey}Loading units...${C.reset}`);
  const units = await queryAll(DB.units);
  console.log(` ${units.length} units`);

  const delinquent = units.filter(u => (getNumber(u, 'Current Balance') || 0) < 0);
  const totalOwed  = delinquent.reduce((s, u) => s + (getNumber(u, 'Current Balance') || 0), 0);
  const DW = [8, 22, 14, 16];
  const DH = ['Unit', 'Owner', 'Balance', 'Status'];
  if (delinquent.length > 0) {
    console.log('    ' + tableRow(DH, DW));
    console.log('    ' + separator(DW));
    for (const u of delinquent.sort((a,b) => (getNumber(a,'Current Balance')||0) - (getNumber(b,'Current Balance')||0))) {
      const uid    = getTitle(u);
      const owner  = getText(u, 'Owner Name').substring(0, 21);
      const bal    = getNumber(u, 'Current Balance') || 0;
      const status = getSelect(u, 'Fee Status');
      console.log('    ' + tableRow([uid, owner, fmt(bal), status], DW));
    }
    console.log(`\n    Delinquent: ${delinquent.length}/${units.length} units  |  Total owed: ${C.red}${C.bold}${fmtMoney(totalOwed)}${C.reset}`);
  } else {
    console.log(`    ${C.green}✅ No delinquent units.${C.reset}`);
  }
  console.log();

  // ── Voting shares ──────────────────────────────────────────────────────────
  console.log(`${C.bold}[4/6] ${AL.shares}${C.reset}`);
  const UW = [8, 26, 10];
  const UH = ['Unit', 'Owner', 'Share %'];
  console.log('    ' + tableRow(UH, UW));
  console.log('    ' + separator(UW));
  let totalShares = 0;
  for (const u of units.sort((a,b) => getTitle(a).localeCompare(getTitle(b)))) {
    const uid   = getTitle(u);
    const owner = getText(u, 'Owner Name').substring(0, 25);
    const share = getNumber(u, 'Ownership Share (%)') || 0;
    totalShares += share;
    console.log('    ' + tableRow([uid, owner, `${share.toFixed(2)}%`], UW));
  }
  console.log('    ' + separator(UW));
  console.log('    ' + tableRow(['TOTAL', '', `${totalShares.toFixed(2)}%`], UW));
  const quorumNeeded = (totalShares / 2).toFixed(4);
  console.log(`\n    ${AL.quorum}: > ${quorumNeeded}% (>50% of ${totalShares.toFixed(2)}%)`);
  console.log();

  // ── Works summary ──────────────────────────────────────────────────────────
  console.log(`${C.bold}[5/6] ${AL.works}${C.reset}`);
  if (DB.works) {
    process.stdout.write(`    ${C.grey}Loading works...${C.reset}`);
    const works = await queryAll(DB.works);
    console.log(` ${works.length} total`);
    const WW = [26, 12, 14, 14];
    const WH = ['Project', 'Status', 'Quoted', 'Total Paid'];
    console.log('    ' + tableRow(WH, WW));
    console.log('    ' + separator(WW));
    for (const w of works) {
      const name   = getTitle(w).substring(0, 25);
      const status = getSelect(w, 'Status').substring(0, 11);
      const quoted = getNumber(w, 'Quoted Amount') || 0;
      const paid   = getNumber(w, 'Total Paid')    || 0;
      console.log('    ' + tableRow([name, status, fmt(quoted), fmt(paid)], WW));
    }
  } else {
    console.log(`    ${C.grey}Works DB not configured.${C.reset}`);
  }
  console.log();

  // ── Draft agenda ──────────────────────────────────────────────────────────
  console.log(`${C.bold}[6/6] ${AL.agenda}${C.reset}`);
  const agendaLines = AL.items.map((item, i) => {
    const line = fillTemplate(item, { year: String(year), nextYear: String(nextYear) });
    return `    ${i + 1}. ${line}`;
  });
  agendaLines.forEach(l => console.log(l));
  console.log();

  // ── Notice to owners ─────────────────────────────────────────────────────
  const agendaForNotice = AL.items.map((item, i) => {
    const line = fillTemplate(item, { year: String(year), nextYear: String(nextYear) });
    return `  ${i + 1}. ${line}`;
  }).join('\n');

  const noticeVars = {
    building:  BUILDING.name || 'Building Administration',
    year:      String(year),
    nextYear:  String(nextYear),
    date:      meetDate,
    location,
    today:     fmtDate(today),
    agenda:    agendaForNotice,
  };

  const noticeSubject = fillTemplate(AL.subject, noticeVars);
  const noticeBody    = fillTemplate(AL.noticeBody, noticeVars);

  console.log('─'.repeat(W));
  console.log(`\n${C.bold}${AL.notice}${C.reset}`);
  console.log(`${C.bold}Subject:${C.reset} ${noticeSubject}\n`);
  console.log(noticeBody);

  console.log(`\n${'═'.repeat(W)}`);
  console.log(`${C.green}✓ AGM preparation package for ${year} complete.${C.reset}`);
  if (DB.communications) {
    await createPage(DB.communications, {
      'Subject':   prop.title(noticeSubject),
      'Type':      prop.select('Meeting Notice'),
      'Channel':   prop.select('Email'),
      'Date':      prop.date(today),
      'Direction': prop.select('Sent'),
      'Content':   prop.text(noticeBody.substring(0, 1800)),
    });
    console.log(`${C.grey}  Meeting notice logged to Communications DB.${C.reset}`);
  }
  console.log();
}

// ═════════════════════════════════════════════════════════════════════════════
// HELP
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// CMD: vote — Record a resolution vote and auto-calculate results
// ─────────────────────────────────────────────────────────────────────────────
// Usage: node condo-cli.js vote <resolution-title> [options]
//   --meeting="Meeting name"  (required — partial match)
//   --A-1=for --A-2=against --A-3=abstain --A-4=absent  (per-unit votes)
//   --desc="Resolution description"
//   --num=1  (resolution number)
// ─────────────────────────────────────────────────────────────────────────────

async function cmdVote(pos, opts) {
  const resTitle = pos.slice(1).join(' ') || opts.title || opts.resolution;
  if (!resTitle) die('Usage: vote <resolution-title> --meeting="Meeting" --A-1=for --A-2=against ...');

  const meetingSearch = opts.meeting || opts.m;
  if (!meetingSearch) die('Missing --meeting="Meeting Name" (partial match supported)');

  const RESOLUTIONS_DB = DB.resolutions;
  if (!RESOLUTIONS_DB) die('Resolutions DB not configured. Add databases.resolutions to config.json');

  // Get units with ownership shares
  process.stdout.write(`${C.grey}Fetching units...${C.reset} `);
  const units = await queryAll(DB.units);
  console.log(`${units.length} found`);

  const unitMap = {}; // unit name → { id, share, owner }
  for (const u of units) {
    const name = getTitle(u);
    if (!name || name === '(template)') continue;
    unitMap[name] = {
      id: u.id,
      share: getNumber(u, 'Ownership Share (%)') || 0,
      owner: getText(u, 'Owner Name'),
    };
  }

  // Find meeting
  const MEETINGS_DB = DB.meetings;
  if (!MEETINGS_DB) die('Meetings DB not configured');
  const meetings = await queryAll(MEETINGS_DB);
  const meeting = meetings.find(m => {
    const t = getTitle(m).toLowerCase();
    return t.includes(meetingSearch.toLowerCase());
  });
  if (!meeting) {
    console.log(`${C.red}✗  Meeting not found: "${meetingSearch}"${C.reset}`);
    console.log(`${C.grey}Available:${C.reset}`);
    meetings.forEach(m => console.log(`  - ${getTitle(m)}`));
    die('Use partial match from above');
  }
  console.log(`${C.green}✓${C.reset} Meeting: ${C.bold}${getTitle(meeting)}${C.reset}`);

  // Parse per-unit votes from opts
  const votes = {};
  const validVotes = ['for', 'against', 'abstain', 'absent'];
  const unitNames = Object.keys(unitMap).sort();

  for (const unitName of unitNames) {
    // Try various key formats: --A-1=for, --a1=for, --A1=for
    const norm = unitName.replace('-', '').toLowerCase();
    const key = Object.keys(opts).find(k => {
      const kn = k.replace('-', '').toLowerCase();
      return kn === unitName.toLowerCase() || kn === norm;
    });
    if (key && validVotes.includes(opts[key].toLowerCase())) {
      votes[unitName] = opts[key].charAt(0).toUpperCase() + opts[key].slice(1).toLowerCase();
      // Capitalize first letter: for → For
      if (votes[unitName] === 'For') votes[unitName] = 'For';
      else if (votes[unitName] === 'Against') votes[unitName] = 'Against';
      else if (votes[unitName] === 'Abstain') votes[unitName] = 'Abstain';
      else if (votes[unitName] === 'Absent') votes[unitName] = 'Absent';
    } else {
      votes[unitName] = 'Absent'; // default if not specified
    }
  }

  // Calculate vote percentages
  let forPct = 0, againstPct = 0, abstainPct = 0, presentPct = 0;
  for (const [unit, vote] of Object.entries(votes)) {
    const share = unitMap[unit]?.share || 0;
    if (vote === 'For')     { forPct += share; presentPct += share; }
    if (vote === 'Against') { againstPct += share; presentPct += share; }
    if (vote === 'Abstain') { abstainPct += share; presentPct += share; }
  }

  const quorumMet = presentPct > 0.5;
  const passed = quorumMet && forPct > (presentPct / 2);

  // Display vote table
  console.log(`\n${C.bold}${C.cyan}🗳️  RESOLUTION: ${resTitle}${C.reset}`);
  console.log('─'.repeat(60));
  console.log(`${C.bold}${'Unit'.padEnd(8)}${'Owner'.padEnd(25)}${'Share'.padEnd(10)}${'Vote'.padEnd(12)}${C.reset}`);
  console.log('─'.repeat(60));

  for (const unitName of unitNames) {
    const info = unitMap[unitName];
    const vote = votes[unitName];
    const shareStr = (info.share * 100).toFixed(1) + '%';
    const voteColor = vote === 'For' ? C.green : vote === 'Against' ? C.red : vote === 'Abstain' ? C.yellow : C.grey;
    const ownerShort = (info.owner || '').slice(0, 23);
    console.log(`${unitName.padEnd(8)}${ownerShort.padEnd(25)}${shareStr.padEnd(10)}${voteColor}${vote.padEnd(12)}${C.reset}`);
  }

  console.log('═'.repeat(60));
  console.log(`Quorum Present:  ${C.bold}${(presentPct * 100).toFixed(1)}%${C.reset} (need >50%)  ${quorumMet ? C.green + '✅ MET' : C.red + '❌ NOT MET'}${C.reset}`);
  console.log(`Votes For:       ${C.green}${(forPct * 100).toFixed(1)}%${C.reset}`);
  console.log(`Votes Against:   ${C.red}${(againstPct * 100).toFixed(1)}%${C.reset}`);
  console.log(`Abstentions:     ${C.yellow}${(abstainPct * 100).toFixed(1)}%${C.reset}`);
  console.log(`Result:          ${passed ? C.green + C.bold + '✅ PASSED' : C.red + C.bold + '❌ REJECTED'}${C.reset}`);

  // Create resolution in Notion
  const properties = {
    'Resolution': prop.title(resTitle),
    'Meeting': prop.relation([meeting.id]),
    'Votes For (%)': prop.number(forPct),
    'Votes Against (%)': prop.number(againstPct),
    'Abstentions (%)': prop.number(abstainPct),
    'Quorum Present (%)': prop.number(presentPct),
    'Quorum Met': prop.checkbox(quorumMet),
    'Passed': prop.checkbox(passed),
  };
  if (opts.desc || opts.description) properties['Description'] = prop.text(opts.desc || opts.description);
  if (opts.num || opts.number) properties['Resolution Number'] = prop.number(parseInt(opts.num || opts.number));

  // Set per-unit vote selects
  for (const [unit, vote] of Object.entries(votes)) {
    properties[unit + ' Vote'] = prop.select(vote);
  }

  await api(() => request('/pages', 'POST', JSON.stringify({
    parent: { database_id: RESOLUTIONS_DB },
    properties,
  })));

  console.log(`\n${C.green}✓  Resolution recorded in Notion${C.reset}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CMD: meeting-report — Full meeting report with quorum & vote breakdown
// ─────────────────────────────────────────────────────────────────────────────

async function cmdMeetingReport(pos, opts) {
  const meetingSearch = pos.slice(1).join(' ') || opts.meeting || opts.m;
  if (!meetingSearch) {
    // List all meetings
    const MEETINGS_DB = DB.meetings;
    if (!MEETINGS_DB) die('Meetings DB not configured');
    const meetings = await queryAll(MEETINGS_DB);
    console.log(`\n${C.bold}${C.cyan}📅 ALL MEETINGS${C.reset}\n`);
    for (const m of meetings) {
      const title = getTitle(m);
      const date = getDate(m, 'Date');
      const type = getSelect(m, 'Type');
      console.log(`  ${C.bold}${fmtDate(date)}${C.reset}  ${title}  ${C.grey}(${type})${C.reset}`);
    }
    console.log(`\n${C.grey}Usage: meeting-report "AGM 2025" (partial match)${C.reset}`);
    return;
  }

  const MEETINGS_DB = DB.meetings;
  const RESOLUTIONS_DB = DB.resolutions;
  if (!MEETINGS_DB) die('Meetings DB not configured');
  if (!RESOLUTIONS_DB) die('Resolutions DB not configured');

  // Get units
  const units = await queryAll(DB.units);
  const unitMap = {};
  for (const u of units) {
    const name = getTitle(u);
    if (!name || name === '(template)') continue;
    unitMap[name] = {
      share: getNumber(u, 'Ownership Share (%)') || 0,
      owner: getText(u, 'Owner Name'),
    };
  }

  // Find meeting
  const meetings = await queryAll(MEETINGS_DB);
  const meeting = meetings.find(m => getTitle(m).toLowerCase().includes(meetingSearch.toLowerCase()));
  if (!meeting) {
    console.log(`${C.red}✗  Meeting not found: "${meetingSearch}"${C.reset}`);
    meetings.forEach(m => console.log(`  - ${getTitle(m)}`));
    return;
  }

  const title = getTitle(meeting);
  const date = getDate(meeting, 'Date');
  const type = getSelect(meeting, 'Type');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${C.bold}${C.cyan} ${title}${C.reset}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Date: ${fmtDate(date)}  |  Type: ${type}`);

  // Get resolutions for this meeting
  const allRes = await queryAll(RESOLUTIONS_DB);
  const meetingRes = allRes.filter(r => {
    const rels = getRelationIds(r, 'Meeting');
    return rels.includes(meeting.id);
  }).sort((a, b) => (getNumber(a, 'Resolution Number') || 0) - (getNumber(b, 'Resolution Number') || 0));

  if (!meetingRes.length) {
    console.log(`\n${C.grey}No resolutions recorded for this meeting.${C.reset}`);
    return;
  }

  // Determine overall quorum from first resolution (all should be same meeting)
  const unitNames = Object.keys(unitMap).sort();

  // Attendance summary from first resolution's votes
  const firstRes = meetingRes[0];
  const present = [], absent = [];
  for (const u of unitNames) {
    const vote = getSelect(firstRes, u + ' Vote');
    if (vote === 'Absent') absent.push(u);
    else present.push(u);
  }

  const presentPct = present.reduce((sum, u) => sum + (unitMap[u]?.share || 0), 0);

  console.log(`\n${C.bold}ATTENDANCE${C.reset}`);
  console.log('─'.repeat(60));
  console.log(`${'Unit'.padEnd(8)}${'Owner'.padEnd(28)}${'Share'.padEnd(10)}${'Status'.padEnd(10)}`);
  console.log('─'.repeat(60));
  for (const u of unitNames) {
    const info = unitMap[u];
    const isPresent = present.includes(u);
    const color = isPresent ? C.green : C.grey;
    console.log(`${color}${u.padEnd(8)}${(info.owner || '').slice(0, 26).padEnd(28)}${((info.share * 100).toFixed(1) + '%').padEnd(10)}${isPresent ? 'Present' : 'Absent'}${C.reset}`);
  }
  console.log('═'.repeat(60));
  console.log(`Present: ${C.bold}${present.length}/${unitNames.length}${C.reset} units = ${C.bold}${(presentPct * 100).toFixed(1)}%${C.reset} of votes  ${presentPct > 0.5 ? C.green + '✅ QUORUM MET' : C.red + '❌ NO QUORUM'}${C.reset}`);

  // Each resolution
  console.log(`\n${C.bold}RESOLUTIONS (${meetingRes.length})${C.reset}`);

  for (const res of meetingRes) {
    const num = getNumber(res, 'Resolution Number');
    const resTitle = getTitle(res);
    const desc = getText(res, 'Description');
    const passed = res.properties['Passed']?.checkbox;
    const forP = getNumber(res, 'Votes For (%)') || 0;
    const againstP = getNumber(res, 'Votes Against (%)') || 0;
    const abstainP = getNumber(res, 'Abstentions (%)') || 0;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`${C.bold}#${num || '?'}  ${resTitle}${C.reset}`);
    if (desc) console.log(`${C.grey}${desc}${C.reset}`);

    // Vote breakdown per unit
    const vFor = [], vAgainst = [], vAbstain = [], vAbsent = [];
    for (const u of unitNames) {
      const vote = getSelect(res, u + ' Vote');
      if (vote === 'For') vFor.push(u);
      else if (vote === 'Against') vAgainst.push(u);
      else if (vote === 'Abstain') vAbstain.push(u);
      else vAbsent.push(u);
    }

    console.log(`  ${C.green}For:${C.reset}     ${vFor.join(', ') || '—'} ${C.bold}(${(forP * 100).toFixed(1)}%)${C.reset}`);
    console.log(`  ${C.red}Against:${C.reset} ${vAgainst.join(', ') || '—'} ${C.bold}(${(againstP * 100).toFixed(1)}%)${C.reset}`);
    console.log(`  ${C.yellow}Abstain:${C.reset} ${vAbstain.join(', ') || '—'} ${C.bold}(${(abstainP * 100).toFixed(1)}%)${C.reset}`);
    if (vAbsent.length) console.log(`  ${C.grey}Absent:  ${vAbsent.join(', ')}${C.reset}`);

    const passedStr = passed ? `${C.green}${C.bold}✅ PASSED` : `${C.red}${C.bold}❌ REJECTED`;
    console.log(`  Result:  ${passedStr}${C.reset}`);
  }

  console.log(`\n${'═'.repeat(60)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────

function showHelp() {
  const bname   = BUILDING.name     || 'Your Building';
  const freq    = BUILDING.feeFrequency || 'quarterly';
  const budget  = fmtMoney(BUILDING.annualBudget || 0);

  console.log(`
${C.bold}${C.cyan}🏢 CONDO MANAGER OS v3.2 — ${bname}${C.reset}
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

${C.bold}PREMIUM COMMANDS (v3.1):${C.reset}

  ${C.cyan}late-fees${C.reset} [--rate=0.02] [--grace=15] [--confirm]
    Calculate late fees on overdue units. Dry-run by default.
    Aliases: latefees, late_fees, penalties
    ${C.grey}Ex: node condo-cli.js late-fees --rate=0.02 --grace=15 --confirm${C.reset}

  ${C.cyan}reminder${C.reset} [--level=1] [--unit=X | --all-overdue] [--lang=es|en|fr]
    Generate payment reminder letters (4 escalation levels).
    Levels: 1=Friendly 2=Formal 3=Final Warning 4=Pre-Legal
    Aliases: remind, notice
    ${C.grey}Ex: node condo-cli.js reminder --all-overdue --level=2 --lang=en${C.reset}
    ${C.grey}Ex: node condo-cli.js reminder --unit=A-3 --level=1 --lang=es${C.reset}

  ${C.cyan}reserve-projection${C.reset} [--years=5] [--annual-contribution=X] [--rate=0.03]
    Project reserve fund growth year-by-year.
    Aliases: reserve, reserves, projection
    ${C.grey}Ex: node condo-cli.js reserve-projection --years=10 --annual-contribution=50000${C.reset}

  ${C.cyan}agm-prep${C.reset} [year] [--date=YYYY-MM-DD] [--lang=es|en|fr]
    Generate full AGM preparation package: financials, delinquency,
    voting shares, works summary, draft agenda, and owner notice.
    Aliases: agm, assembly
    ${C.grey}Ex: node condo-cli.js agm-prep 2026 --date=2026-03-15 --lang=es${C.reset}

  ${C.cyan}vote${C.reset} <resolution-title> --meeting="Meeting" --A-1=for --A-2=against ...
    Record a resolution vote. Auto-calculates weighted % from ownership shares.
    Unspecified units default to Absent.
    ${C.grey}Ex: node condo-cli.js vote "Budget 2026" --meeting="AGM 2025" --A-1=absent --A-2=for --A-3=for --A-4=for --A-5=for --A-6=for --A-7=for${C.reset}

  ${C.cyan}meeting-report${C.reset} [meeting-name]
    Full meeting report: attendance, quorum, all resolutions with vote breakdown.
    Without arguments, lists all meetings.
    Aliases: meeting, minutes
    ${C.grey}Ex: node condo-cli.js meeting-report "AGM 2025"
    Ex: node condo-cli.js meeting-report${C.reset}

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
      case 'late-fees':
      case 'latefees':
      case 'late_fees':
      case 'penalties':
        await cmdLateFees(pos, opts);
        break;
      case 'reminder':
      case 'remind':
      case 'notice':
        await cmdReminder(pos, opts);
        break;
      case 'reserve-projection':
      case 'reserve':
      case 'reserves':
      case 'projection':
        await cmdReserveProjection(pos, opts);
        break;
      case 'agm-prep':
      case 'agm':
      case 'assembly':
        await cmdAgmPrep(pos, opts);
        break;
      case 'vote':
      case 'resolution':
        await cmdVote(pos, opts);
        break;
      case 'meeting-report':
      case 'meeting':
      case 'minutes':
        await cmdMeetingReport(pos, opts);
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
