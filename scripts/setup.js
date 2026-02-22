#!/usr/bin/env node
// =============================================================================
// Condo Manager OS v3.0 — Database Setup Script
// =============================================================================
// One-command Notion database setup. Creates all 10 databases with full
// schemas, relations, formulas, rollups, and select option colors.
// ZERO manual steps in Notion.
//
// Usage:
//   node setup.js                         # Interactive (reads config.json)
//   node setup.js --parent-page=PAGE_ID   # Override parent page ID
//   node setup.js --dry-run               # Show what would be created (no API calls)
//   node setup.js --force                 # Recreate existing databases
//   node setup.js --skip-formulas         # Skip formula/rollup phase (useful for debugging)
//
// Config file: ~/.openclaw/skills/condo-manager-os/config.json
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ---------------------------------------------------------------------------
// Path constants
// ---------------------------------------------------------------------------
const CONFIG_PATH   = path.join(os.homedir(), '.openclaw', 'skills', 'condo-manager-os', 'config.json');
const BRIDGE_PATH   = path.join(os.homedir(), '.openclaw', 'workspace', 'app', 'skills', 'notion', 'bridge.js');
const TOKEN_PATH    = path.join(os.homedir(), '.openclaw', 'workspace', 'secrets', 'notion_token.txt');

// ---------------------------------------------------------------------------
// Tiny logger with colours
// ---------------------------------------------------------------------------
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
};

const log = {
  info:    (...a) => console.log(`${C.cyan}ℹ${C.reset}`, ...a),
  success: (...a) => console.log(`${C.green}✓${C.reset}`, ...a),
  warn:    (...a) => console.log(`${C.yellow}⚠${C.reset}`, ...a),
  error:   (...a) => console.error(`${C.red}✗${C.reset}`, ...a),
  skip:    (...a) => console.log(`${C.grey}↷${C.reset}`, ...a),
  dry:     (...a) => console.log(`${C.yellow}[DRY]${C.reset}`, ...a),
  section: (t)    => console.log(`\n${C.bold}${C.cyan}── ${t} ${C.reset}`),
};

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    parentPage:   null,
    dryRun:       false,
    force:        false,
    skipFormulas: false,
  };
  for (const arg of args) {
    if (arg.startsWith('--parent-page=')) opts.parentPage   = arg.split('=')[1].trim();
    else if (arg === '--dry-run')          opts.dryRun       = true;
    else if (arg === '--force')            opts.force        = true;
    else if (arg === '--skip-formulas')    opts.skipFormulas = true;
    else { log.warn(`Unknown argument: ${arg}`); }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config not found at ${CONFIG_PATH}\nRun 'node install.js' first or create the file manually.`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Direct Notion API (wraps bridge pattern but adds createDatabase)
// ---------------------------------------------------------------------------
function getToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Notion token not found at ${TOKEN_PATH}`);
  }
  return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
}

const https = require('https');

function notionRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.notion.com',
      path:     `/v1${path}`,
      method,
      headers: {
        'Authorization':   `Bearer ${getToken()}`,
        'Notion-Version':  '2022-06-28',
        'Content-Type':    'application/json',
      },
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode} ${method} ${path}\n${JSON.stringify(parsed, null, 2)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Rate-limit-safe delay between API calls
const delay = ms => new Promise(r => setTimeout(r, ms));
const API_DELAY = 400; // ms

// Create a database under a page
async function createDatabase(parentPageId, title, properties, icon = null) {
  const body = {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: title } }],
    properties,
  };
  if (icon) body.icon = icon;
  return notionRequest('/databases', 'POST', body);
}

// Update a database (add/modify properties, e.g. formulas/rollups)
async function updateDatabase(dbId, properties) {
  return notionRequest(`/databases/${dbId}`, 'PATCH', { properties });
}

// ---------------------------------------------------------------------------
// Property schema builders
// ---------------------------------------------------------------------------
const prop = {
  title:    ()       => ({ title: {} }),
  text:     ()       => ({ rich_text: {} }),
  number:   (fmt)    => ({ number: { format: fmt || 'number' } }),
  email:    ()       => ({ email: {} }),
  phone:    ()       => ({ phone_number: {} }),
  date:     ()       => ({ date: {} }),
  checkbox: ()       => ({ checkbox: {} }),
  files:    ()       => ({ files: {} }),
  url:      ()       => ({ url: {} }),

  select: (options) => ({
    select: {
      options: options.map(o => {
        if (typeof o === 'string') return { name: o };
        return { name: o.name, color: o.color };
      }),
    },
  }),

  multiSelect: (options) => ({
    multi_select: {
      options: options.map(o => {
        if (typeof o === 'string') return { name: o };
        return { name: o.name, color: o.color };
      }),
    },
  }),

  // Relation — MUST use dual_property (single_property returns 400)
  relation: (databaseId) => ({
    relation: {
      database_id: databaseId,
      type: 'dual_property',
      dual_property: {},
    },
  }),

  // Formula — expression string
  formula: (expression) => ({
    formula: { expression },
  }),

  // Rollup — needs relation prop name, rollup prop name, function
  rollup: (relationPropName, rollupPropName, fn) => ({
    rollup: {
      relation_property_name: relationPropName,
      rollup_property_name:   rollupPropName,
      function:               fn, // sum, average, count, etc.
    },
  }),
};

// ---------------------------------------------------------------------------
// Colour palette helpers for select options
// ---------------------------------------------------------------------------
// Notion colours: default, gray, brown, orange, yellow, green, blue, purple, pink, red
const STATUS_COLORS = {
  'Owner-Occupied': 'green',
  'Rented':         'blue',
  'Vacant':         'gray',
  'Under Renovation': 'orange',
  'Foreclosure':    'red',
};

const FEE_STATUS_COLORS = {
  'Current':         'green',
  'Overdue 1-30':    'yellow',
  'Overdue 31-60':   'orange',
  'Overdue 61-90':   'red',
  'Overdue 90+':     'red',
  'Payment Plan':    'purple',
  'Legal':           'pink',
};

const ACCOUNT_TYPE_COLORS = {
  'Operating':    'blue',
  'Savings':      'green',
  'Petty Cash':   'yellow',
  'Reserve Fund': 'purple',
  'Escrow':       'gray',
};

const CURRENCY_COLORS = {
  'USD': 'green',
  'EUR': 'blue',
  'DOP': 'orange',
  'GBP': 'purple',
  'CAD': 'red',
  'MXN': 'brown',
};

const DEPARTMENT_COLORS = {
  'Utilities':      'blue',
  'Maintenance':    'orange',
  'Security':       'red',
  'Insurance':      'purple',
  'Cleaning':       'green',
  'Administrative': 'gray',
  'Legal':          'pink',
  'Reserve Fund':   'yellow',
  'Capital Works':  'brown',
  'Other':          'default',
};

const BUDGET_STATUS_COLORS = {
  'On Track':    'green',
  'Over Budget': 'red',
  'Under Budget': 'blue',
};

const LEDGER_TYPE_COLORS = {
  'Fee Call':           'blue',
  'Payment Received':   'green',
  'Work Assessment':    'orange',
  'Adjustment':         'gray',
  'Late Fee':           'red',
  'Credit':             'purple',
  'Refund':             'yellow',
  'Private Charge':     'pink',
  'Year-End Closing':   'brown',
};

const LEDGER_CATEGORY_COLORS = {
  'Common Charges':             'blue',
  'Payment':                    'green',
  'Extraordinary Assessment':   'orange',
  'Penalties & Fees':           'red',
  'Legal Fees':                 'pink',
  'Administrative':             'gray',
  'Private':                    'purple',
};

const PAYMENT_METHOD_COLORS = {
  'Cash':          'green',
  'Bank Transfer': 'blue',
  'Check':         'gray',
  'Credit Card':   'purple',
};

const EXPENSE_CATEGORY_COLORS = {
  'Utilities':              'blue',
  'Maintenance':            'orange',
  'Cleaning':               'green',
  'Management Fee':         'purple',
  'Bank Charges':           'gray',
  'Insurance':              'yellow',
  'Capital Works':          'brown',
  'Legal & Compliance':     'pink',
  'Penalties & Collections':'red',
  'Other':                  'default',
};

const EXPENSE_STATUS_COLORS = {
  'Pending':       'yellow',
  'Approved':      'blue',
  'Paid':          'green',
  'Disputed':      'orange',
  'Voided':        'gray',
  'Para Contador': 'purple',
};

const QUARTER_COLORS = {
  'Q1': 'blue',
  'Q2': 'green',
  'Q3': 'orange',
  'Q4': 'purple',
};

const PRIORITY_COLORS = {
  'Emergency 🔴': 'red',
  'High 🟠':      'orange',
  'Medium 🟡':    'yellow',
  'Low 🟢':       'green',
};

const MAINT_STATUS_COLORS = {
  'New':               'blue',
  'Assigned':          'purple',
  'In Progress':       'orange',
  'Waiting on Parts':  'yellow',
  'Completed':         'green',
  'Closed':            'gray',
  'Cancelled':         'red',
};

const MAINT_CATEGORY_COLORS = {
  'Plumbing':    'blue',
  'Electrical':  'yellow',
  'HVAC':        'orange',
  'Structural':  'brown',
  'Roofing':     'gray',
  'Common Area': 'green',
  'Pool':        'blue',
  'Generator':   'red',
  'Painting':    'purple',
  'Other':       'default',
};

const VOTE_TYPE_COLORS = {
  'AGM':                    'blue',
  'Electronic Vote':        'purple',
  'Extraordinary Assembly': 'orange',
};

const PROJECT_STATUS_COLORS = {
  'Proposed':           'gray',
  'Approved':           'blue',
  'Contractor Selected':'purple',
  'In Progress':        'orange',
  'Completed':          'green',
  'On Hold':            'yellow',
  'Cancelled':          'red',
};

const COMMS_TYPE_COLORS = {
  'Fee Call':              'blue',
  'Payment Reminder':      'orange',
  'Payment Confirmation':  'green',
  'Financial Report':      'purple',
  'Violation Notice':      'red',
  'Meeting Notice':        'yellow',
  'Work Update':           'brown',
  'Emergency Alert':       'red',
  'General Notice':        'gray',
  'Legal Notice':          'pink',
  'Year-End Statement':    'blue',
};

const CHANNEL_COLORS = {
  'Email':     'blue',
  'WhatsApp':  'green',
  'Letter':    'gray',
  'In Person': 'yellow',
  'Phone':     'purple',
};

const DIRECTION_COLORS = {
  'Sent':     'blue',
  'Received': 'green',
};

const MEETING_TYPE_COLORS = {
  'AGM':                    'blue',
  'Extraordinary Assembly': 'orange',
  'Board Meeting':          'purple',
  'Committee Meeting':      'green',
};

const MOVEMENT_COLORS = {
  'Debit':           'red',
  'Credit':          'green',
  'Opening Balance': 'gray',
};

const ACCT_MOV_CATEGORY_COLORS = {
  'Owner Payment':  'green',
  'Utilities':      'blue',
  'Management Fee': 'purple',
  'Maintenance':    'orange',
  'Cleaning':       'yellow',
  'Insurance':      'gray',
  'Bank Charges':   'brown',
  'Capital Works':  'pink',
  'Transfer':       'default',
  'Other':          'default',
};

// Helper: build select option array from a colour map
function coloredOptions(colorMap) {
  return Object.entries(colorMap).map(([name, color]) => ({ name, color }));
}

// ---------------------------------------------------------------------------
// Database schema definitions
// Each is a function that receives an `ids` object (previously created DB IDs)
// so relations can reference them.
// ---------------------------------------------------------------------------

function schema_unitsRegistry() {
  return {
    'Unit':               prop.title(),
    'Owner Name':         prop.text(),
    'Owner Email':        prop.email(),
    'Owner Phone':        prop.phone(),
    'Ownership Share (%)': prop.number('percent'),
    'Status':             prop.select(coloredOptions(STATUS_COLORS)),
    'Size':               prop.number('number'),
    'Bedrooms':           prop.number('number'),
    'Floor':              prop.number('number'),
    'Parking Space':      prop.text(),
    'Current Balance':    prop.number('number'),
    'Fee Status':         prop.select(coloredOptions(FEE_STATUS_COLORS)),
    'Lease Start':        prop.date(),
    'Lease End':          prop.date(),
    'Last Payment Date':  prop.date(),
    'Notes':              prop.text(),
  };
}

function schema_cashPosition() {
  return {
    'Account':         prop.title(),
    'Bank':            prop.text(),
    'Account Type':    prop.select(coloredOptions(ACCOUNT_TYPE_COLORS)),
    'Currency':        prop.select(coloredOptions(CURRENCY_COLORS)),
    'Current Balance': prop.number('number'),
    'Last Updated':    prop.date(),
    'Notes':           prop.text(),
  };
}

function schema_budget() {
  return {
    'Category':      prop.title(),
    'Annual Budget': prop.number('number'),
    'Q1 Actual':     prop.number('number'),
    'Q2 Actual':     prop.number('number'),
    'Q3 Actual':     prop.number('number'),
    'Q4 Actual':     prop.number('number'),
    'Department':    prop.select(coloredOptions(DEPARTMENT_COLORS)),
    'Status':        prop.select(coloredOptions(BUDGET_STATUS_COLORS)),
    'Fiscal Year':   prop.number('number'),
    'Notes':         prop.text(),
  };
}

function schema_ownerLedger(ids) {
  return {
    'Entry':          prop.title(),
    'Unit':           prop.relation(ids.unitsRegistry),
    'Date':           prop.date(),
    'Type':           prop.select(coloredOptions(LEDGER_TYPE_COLORS)),
    'Debit':          prop.number('number'),
    'Credit':         prop.number('number'),
    'Balance After':  prop.number('number'),
    'Period':         prop.text(),
    'Category':       prop.select(coloredOptions(LEDGER_CATEGORY_COLORS)),
    'Payment Method': prop.select(coloredOptions(PAYMENT_METHOD_COLORS)),
    'Reference':      prop.text(),
    'Notes':          prop.text(),
    'Verified':       prop.checkbox(),
    'Fiscal Year':    prop.number('number'),
  };
}

function schema_expenses(ids) {
  return {
    'Description':    prop.title(),
    'Amount':         prop.number('number'),
    'Date':           prop.date(),
    'Category':       prop.select(coloredOptions(EXPENSE_CATEGORY_COLORS)),
    'Vendor':         prop.text(),
    'Invoice Number': prop.text(),
    'Receipt':        prop.files(),
    'Payment Method': prop.select(coloredOptions(PAYMENT_METHOD_COLORS)),
    'Status':         prop.select(coloredOptions(EXPENSE_STATUS_COLORS)),
    'Fiscal Year':    prop.number('number'),
    'Quarter':        prop.select(coloredOptions(QUARTER_COLORS)),
    'Is Extraordinary': prop.checkbox(),
    'Notes':          prop.text(),
    'Unit':           prop.relation(ids.unitsRegistry),
    'Budget Line':    prop.relation(ids.budget),
    'Paid From':      prop.relation(ids.cashPosition),
  };
}

function schema_maintenanceRequests(ids) {
  return {
    'Request':        prop.title(),
    'Priority':       prop.select(coloredOptions(PRIORITY_COLORS)),
    'Status':         prop.select(coloredOptions(MAINT_STATUS_COLORS)),
    'Category':       prop.select(coloredOptions(MAINT_CATEGORY_COLORS)),
    'Location':       prop.text(),
    'Reported By':    prop.text(),
    'Reported Date':  prop.date(),
    'Assigned To':    prop.text(),
    'Estimated Cost': prop.number('number'),
    'Actual Cost':    prop.number('number'),
    'Completed Date': prop.date(),
    'Notes':          prop.text(),
    'Unit':           prop.relation(ids.unitsRegistry),
    'Related Expense': prop.relation(ids.expenses),
  };
}

function schema_worksProjects(ids) {
  return {
    'Project':              prop.title(),
    'Description':          prop.text(),
    'Contractor':           prop.text(),
    'Quoted Amount':        prop.number('number'),
    'Vote Date':            prop.date(),
    'Vote Type':            prop.select(coloredOptions(VOTE_TYPE_COLORS)),
    'Vote Result':          prop.text(),
    'Status':               prop.select(coloredOptions(PROJECT_STATUS_COLORS)),
    'Advance Amount':       prop.number('number'),
    'Advance Date':         prop.date(),
    'Progress Amount':      prop.number('number'),
    'Progress Date':        prop.date(),
    'Final Amount':         prop.number('number'),
    'Final Date':           prop.date(),
    'Owner Assessment Total': prop.number('number'),
    'Start Date':           prop.date(),
    'Expected Completion':  prop.date(),
    'Actual Completion':    prop.date(),
    'Notes':                prop.text(),
    'Related Expenses':     prop.relation(ids.expenses),
  };
}

function schema_communicationsLog(ids) {
  return {
    'Subject':           prop.title(),
    'Type':              prop.select(coloredOptions(COMMS_TYPE_COLORS)),
    'Channel':           prop.select(coloredOptions(CHANNEL_COLORS)),
    'Date':              prop.date(),
    'Direction':         prop.select(coloredOptions(DIRECTION_COLORS)),
    'Content':           prop.text(),
    'Follow-up Required': prop.checkbox(),
    'Follow-up Date':    prop.date(),
    'Sent By':           prop.text(),
    'Unit':              prop.relation(ids.unitsRegistry),
  };
}

function schema_meetings() {
  return {
    'Meeting':    prop.title(),
    'Date':       prop.date(),
    'Type':       prop.select(coloredOptions(MEETING_TYPE_COLORS)),
    'Location':   prop.text(),
    'Quorum Met': prop.checkbox(),
    'Attendees':  prop.text(),
    'Minutes':    prop.text(),
    'Resolutions': prop.text(),
    'Next Meeting': prop.date(),
    'Action Items': prop.text(),
  };
}

function schema_accountMovements(ids) {
  return {
    'Description':  prop.title(),
    'Date':         prop.date(),
    'Movement':     prop.select(coloredOptions(MOVEMENT_COLORS)),
    'Amount':       prop.number('number'),
    'Balance After': prop.number('number'),
    'Category':     prop.select(coloredOptions(ACCT_MOV_CATEGORY_COLORS)),
    'Fiscal Year':  prop.number('number'),
    'Reference':    prop.text(),
    'Account':      prop.relation(ids.cashPosition),
  };
}

function schema_resolutions(ids) {
  const voteOpts = [
    { name: 'For', color: 'green' },
    { name: 'Against', color: 'red' },
    { name: 'Abstain', color: 'yellow' },
    { name: 'Absent', color: 'default' },
  ];
  const schema = {
    'Resolution':        prop.title(),
    'Meeting':           prop.relation(ids.meetings),
    'Resolution Number': prop.number('number'),
    'Description':       prop.text(),
    'Passed':            { checkbox: {} },
    'Notes':             prop.text(),
    'Votes For (%)':     prop.number('percent'),
    'Votes Against (%)': prop.number('percent'),
    'Abstentions (%)':   prop.number('percent'),
    'Quorum Present (%)':prop.number('percent'),
    'Quorum Met':        { checkbox: {} },
  };
  // Per-unit vote selects — dynamically generated from building config
  const unitCount = config.building?.units || 7;
  const prefix = config.building?.unitPrefix || 'A';
  for (let i = 1; i <= unitCount; i++) {
    schema[`${prefix}-${i} Vote`] = { select: { options: voteOpts } };
  }
  return schema;
}

// ---------------------------------------------------------------------------
// Post-creation: formulas & rollups
// These are added via PATCH /databases/:id after all DBs exist, so relation
// property names are already known.
// ---------------------------------------------------------------------------

function formulasForUnitsRegistry(annualBudget, ownerLedgerRelationPropName) {
  // annualBudget comes from building config (used in fee formulas)
  return {
    'Monthly Fee': prop.formula(
      `prop("Ownership Share (%)") * ${annualBudget} / 12`
    ),
    'Quarterly Fee': prop.formula(
      `prop("Ownership Share (%)") * ${annualBudget} / 4`
    ),
    // Rollups — relation prop name is "Unit" in Owner Ledger, which creates
    // a back-relation in Units Registry. The back-relation property name
    // in Units Registry is automatically named after the source DB + property.
    // We pass the exact name returned by Notion (stored in ids).
    'Total Debits': prop.rollup(ownerLedgerRelationPropName, 'Debit', 'sum'),
    'Total Credits': prop.rollup(ownerLedgerRelationPropName, 'Credit', 'sum'),
  };
}

function formulasForBudget() {
  return {
    'Annual Actual': prop.formula(
      `prop("Q1 Actual") + prop("Q2 Actual") + prop("Q3 Actual") + prop("Q4 Actual")`
    ),
    'Variance': prop.formula(
      `prop("Annual Actual") - prop("Annual Budget")`
    ),
    'Variance %': prop.formula(
      `if(prop("Annual Budget") == 0, 0, prop("Variance") / prop("Annual Budget") * 100)`
    ),
  };
}

function formulasForWorksProjects() {
  return {
    'Total Paid': prop.formula(
      `prop("Advance Amount") + prop("Progress Amount") + prop("Final Amount")`
    ),
    'Remaining': prop.formula(
      `prop("Quoted Amount") - prop("Total Paid")`
    ),
  };
}

// ---------------------------------------------------------------------------
// Discover the back-relation property name in Units Registry
// When we create a dual_property relation "Unit" in Owner Ledger pointing to
// Units Registry, Notion auto-creates a mirrored property in Units Registry.
// We need to fetch that property name before adding rollups.
// ---------------------------------------------------------------------------
async function getBackRelationPropName(unitsRegistryId, ownerLedgerDbId) {
  const db = await notionRequest(`/databases/${unitsRegistryId}`);
  // Find the relation property that points to ownerLedgerDbId
  for (const [name, schema] of Object.entries(db.properties)) {
    if (
      schema.type === 'relation' &&
      schema.relation &&
      schema.relation.database_id &&
      schema.relation.database_id.replace(/-/g, '') === ownerLedgerDbId.replace(/-/g, '')
    ) {
      return name;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main setup flow
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();

  // ── Load config ───────────────────────────────────────────────────────────
  log.section('Loading configuration');
  let cfg;
  try {
    cfg = loadConfig();
    log.success(`Config loaded from ${CONFIG_PATH}`);
  } catch (e) {
    log.error(e.message);
    process.exit(1);
  }

  // Override parent page from CLI
  if (opts.parentPage) {
    cfg.notion = cfg.notion || {};
    cfg.notion.parentPageId = opts.parentPage;
    log.info(`Parent page overridden: ${opts.parentPage}`);
  }

  const parentPageId = cfg.notion && cfg.notion.parentPageId;
  if (!parentPageId) {
    log.error('No parentPageId in config. Use --parent-page=PAGE_ID or set notion.parentPageId in config.json');
    process.exit(1);
  }

  // Ensure databases map exists
  cfg.databases = cfg.databases || {};

  // Building config
  const building = cfg.building || {};
  const buildingName   = building.name    || 'My Building';
  const annualBudget   = building.annualBudget || 0; // needed for fee formulas
  const feeFrequency   = building.feeFrequency || 'quarterly';

  if (opts.dryRun) {
    log.dry('DRY RUN MODE — no API calls will be made');
  }

  log.info(`Building: ${buildingName}`);
  log.info(`Parent page: ${parentPageId}`);
  log.info(`Annual budget (for fee formulas): ${annualBudget}`);
  log.info(`Fee frequency: ${feeFrequency}`);

  // ── Verify token ──────────────────────────────────────────────────────────
  if (!opts.dryRun) {
    try {
      getToken();
      log.success('Notion token found');
    } catch (e) {
      log.error(e.message);
      process.exit(1);
    }
  }

  // ── Helper: create one database ───────────────────────────────────────────
  async function createDb(key, emoji, title, schemaFn, idsDep = {}) {
    const fullTitle = `${emoji} ${title}`;

    // Already exists and not forcing?
    if (cfg.databases[key] && !opts.force) {
      log.skip(`${fullTitle} — already exists (${cfg.databases[key]}), skipping. Use --force to recreate.`);
      return cfg.databases[key];
    }

    if (opts.force && cfg.databases[key]) {
      log.warn(`${fullTitle} — --force set, will create a new copy (old ID: ${cfg.databases[key]})`);
    }

    const schema = schemaFn(idsDep);

    if (opts.dryRun) {
      log.dry(`Would create: ${fullTitle}`);
      log.dry(`  Properties: ${Object.keys(schema).join(', ')}`);
      return `dry-run-id-${key}`;
    }

    log.info(`Creating: ${fullTitle}…`);
    try {
      const icon = { type: 'emoji', emoji };
      const result = await createDatabase(parentPageId, fullTitle, schema, icon);
      const dbId = result.id;
      cfg.databases[key] = dbId;
      saveConfig(cfg); // persist immediately so we don't lose IDs on crash
      log.success(`${fullTitle} → ${dbId}`);
      await delay(API_DELAY);
      return dbId;
    } catch (e) {
      log.error(`Failed to create ${fullTitle}:`);
      log.error(e.message);
      throw e;
    }
  }

  // ── Phase 1: Create databases in dependency order ─────────────────────────
  log.section('Phase 1: Creating databases');

  // 1. Units Registry (no relations yet)
  const unitsRegistryId = await createDb(
    'unitsRegistry', '🏠', 'Units Registry',
    () => schema_unitsRegistry()
  );

  // 2. Cash Position (no relations)
  const cashPositionId = await createDb(
    'cashPosition', '🏦', 'Cash Position',
    () => schema_cashPosition()
  );

  // 3. Budget (no relations)
  const budgetId = await createDb(
    'budget', '📋', 'Budget',
    () => schema_budget()
  );

  // 4. Owner Ledger (relation → Units Registry)
  const ownerLedgerId = await createDb(
    'ownerLedger', '💰', 'Owner Ledger',
    (ids) => schema_ownerLedger(ids),
    { unitsRegistry: unitsRegistryId }
  );

  // 5. Expenses (relations → Units Registry, Budget, Cash Position)
  const expensesId = await createDb(
    'expenses', '💸', 'Expenses',
    (ids) => schema_expenses(ids),
    { unitsRegistry: unitsRegistryId, budget: budgetId, cashPosition: cashPositionId }
  );

  // 6. Maintenance Requests (relations → Units Registry, Expenses)
  const maintenanceId = await createDb(
    'maintenanceRequests', '🔧', 'Maintenance Requests',
    (ids) => schema_maintenanceRequests(ids),
    { unitsRegistry: unitsRegistryId, expenses: expensesId }
  );

  // 7. Works & Projects (relation → Expenses)
  const worksProjectsId = await createDb(
    'worksProjects', '🏗️', 'Works & Projects',
    (ids) => schema_worksProjects(ids),
    { expenses: expensesId }
  );

  // 8. Communications Log (relation → Units Registry)
  const communicationsId = await createDb(
    'communicationsLog', '📨', 'Communications Log',
    (ids) => schema_communicationsLog(ids),
    { unitsRegistry: unitsRegistryId }
  );

  // 9. Meetings (no relations)
  const meetingsId = await createDb(
    'meetings', '📅', 'Meetings',
    () => schema_meetings()
  );

  // 10. Account Movements (relation → Cash Position)
  const accountMovementsId = await createDb(
    'accountMovements', '💳', 'Account Movements',
    (ids) => schema_accountMovements(ids),
    { cashPosition: cashPositionId }
  );

  // 11. Resolutions & Votes (relation → Meetings)
  const resolutionsId = await createDb(
    'resolutions', '🗳️', 'Resolutions & Votes',
    (ids) => schema_resolutions(ids),
    { meetings: meetingsId }
  );

  log.section('Phase 1 complete — all databases created');
  log.info('Database IDs saved to config.json');

  // ── Phase 2: Formulas & Rollups ───────────────────────────────────────────
  if (opts.skipFormulas) {
    log.warn('Skipping formula/rollup phase (--skip-formulas)');
  } else {
    log.section('Phase 2: Adding formulas and rollups');

    if (opts.dryRun) {
      log.dry('Would add formulas to: Units Registry, Budget, Works & Projects');
      log.dry('Would add rollups to: Units Registry (from Owner Ledger relation)');
    } else {

      // ── 2a. Budget formulas ──────────────────────────────────────────────
      log.info('Adding formulas to Budget…');
      try {
        await updateDatabase(budgetId, formulasForBudget());
        log.success('Budget formulas added');
        await delay(API_DELAY);
      } catch (e) {
        log.warn('Could not add Budget formulas (formula props may already exist or reference missing props):');
        log.warn(e.message);
      }

      // ── 2b. Works & Projects formulas ───────────────────────────────────
      log.info('Adding formulas to Works & Projects…');
      try {
        await updateDatabase(worksProjectsId, formulasForWorksProjects());
        log.success('Works & Projects formulas added');
        await delay(API_DELAY);
      } catch (e) {
        log.warn('Could not add Works & Projects formulas:');
        log.warn(e.message);
      }

      // ── 2c. Units Registry: discover back-relation name ─────────────────
      // The dual_property relation "Unit" in Owner Ledger creates a mirrored
      // property in Units Registry. Fetch the DB to find its exact name.
      log.info('Discovering back-relation property name in Units Registry…');
      let backRelPropName = null;
      try {
        backRelPropName = await getBackRelationPropName(unitsRegistryId, ownerLedgerId);
        if (backRelPropName) {
          log.success(`Back-relation property: "${backRelPropName}"`);
        } else {
          log.warn('Could not find back-relation property. Rollups will be skipped.');
        }
        await delay(API_DELAY);
      } catch (e) {
        log.warn('Error fetching Units Registry schema:', e.message);
      }

      // ── 2d. Units Registry: formulas + rollups ───────────────────────────
      log.info('Adding formulas and rollups to Units Registry…');
      try {
        const unitsProps = {};

        // Always add fee formulas
        const feeFormulas = formulasForUnitsRegistry(annualBudget, backRelPropName);
        unitsProps['Monthly Fee']   = feeFormulas['Monthly Fee'];
        unitsProps['Quarterly Fee'] = feeFormulas['Quarterly Fee'];

        // Only add rollups if we found the back-relation prop
        if (backRelPropName) {
          unitsProps['Total Debits']  = feeFormulas['Total Debits'];
          unitsProps['Total Credits'] = feeFormulas['Total Credits'];
        }

        await updateDatabase(unitsRegistryId, unitsProps);
        log.success('Units Registry formulas/rollups added');
        await delay(API_DELAY);
      } catch (e) {
        log.warn('Could not add all Units Registry formulas/rollups:');
        log.warn(e.message);
        log.warn('Tip: Notion formulas referencing computed properties may need manual adjustment.');
      }
    }

    log.section('Phase 2 complete');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log.section('Setup Complete 🎉');
  console.log('');
  console.log(`${C.bold}Databases created:${C.reset}`);
  const dbNames = {
    unitsRegistry:    '🏠 Units Registry',
    cashPosition:     '🏦 Cash Position',
    budget:           '📋 Budget',
    ownerLedger:      '💰 Owner Ledger',
    expenses:         '💸 Expenses',
    maintenanceRequests: '🔧 Maintenance Requests',
    worksProjects:    '🏗️ Works & Projects',
    communicationsLog:'📨 Communications Log',
    meetings:         '📅 Meetings',
    accountMovements: '💳 Account Movements',
    resolutions:      '🗳️ Resolutions & Votes',
  };
  for (const [key, label] of Object.entries(dbNames)) {
    const id = cfg.databases[key];
    if (id) {
      console.log(`  ${C.green}${label}${C.reset}`);
      console.log(`  ${C.grey}  ID: ${id}${C.reset}`);
    } else {
      console.log(`  ${C.yellow}${label}${C.reset} ${C.grey}(not created)${C.reset}`);
    }
  }
  console.log('');
  console.log(`${C.grey}All IDs saved to: ${CONFIG_PATH}${C.reset}`);
  console.log('');

  if (!opts.dryRun) {
    console.log(`${C.bold}${C.green}✅ Condo Manager OS is ready!${C.reset}`);
    console.log(`   Open Notion and navigate to your parent page to see the new databases.`);
    if (annualBudget === 0) {
      console.log('');
      console.log(`${C.yellow}⚠  Tip: Set building.annualBudget in config.json and re-run`);
      console.log(`   with --skip-databases to regenerate fee formulas with the correct budget.${C.reset}`);
    }
  } else {
    console.log(`${C.yellow}[DRY RUN] No changes were made. Remove --dry-run to execute.${C.reset}`);
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------
main().catch(err => {
  log.error('Unhandled error:');
  log.error(err.message || err);
  process.exit(1);
});
