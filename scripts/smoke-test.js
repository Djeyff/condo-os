#!/usr/bin/env node
// =============================================================================
// Condo Manager OS — Smoke Test Suite
// =============================================================================
// Validates configuration, database connectivity, relations, and CLI commands.
// Run before releasing or after setup to catch issues early.
//
// Usage: node smoke-test.js [--fix] [--verbose]
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(
  os.homedir(), '.openclaw', 'skills', 'condo-manager-os', 'config.json'
);

let passed = 0, failed = 0, warned = 0;

function ok(msg)   { passed++; console.log(`  ✅ ${msg}`); }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`); }
function warn(msg) { warned++; console.log(`  ⚠️  ${msg}`); }
function section(msg) { console.log(`\n${'═'.repeat(50)}\n  ${msg}\n${'═'.repeat(50)}`); }

// ─── Test 1: Config ─────────────────────────────────────────────────────────

function testConfig() {
  section('1. Configuration');

  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    ok('config.json readable');
  } catch (e) {
    fail('config.json not found or invalid JSON');
    return null;
  }

  // Building
  if (config.building?.name) ok(`Building: ${config.building.name}`);
  else fail('building.name missing');

  if (config.building?.units > 0) ok(`Units: ${config.building.units}`);
  else fail('building.units missing or 0');

  if (config.building?.currency) ok(`Currency: ${config.building.currency}`);
  else warn('building.currency not set (defaults to DOP)');

  if (config.building?.annualBudget > 0) ok(`Budget: ${config.building.annualBudget}`);
  else warn('building.annualBudget not set');

  // Databases
  const requiredDBs = ['units', 'ledger', 'budget', 'expenses', 'maintenance',
    'works', 'cashPosition', 'communications', 'meetings', 'movements', 'resolutions'];

  for (const db of requiredDBs) {
    if (config.databases?.[db]) ok(`DB ${db}: ${config.databases[db].slice(0, 8)}...`);
    else fail(`DB ${db} not configured`);
  }

  // Portal
  if (config.portal?.botToken || process.env.PORTAL_BOT_TOKEN) ok('Portal bot token configured');
  else warn('Portal bot token not set (portal won\'t work)');

  // Dashboards
  const dashPages = ['kpi', 'financial', 'delinquency', 'maintenance', 'works'];
  for (const d of dashPages) {
    if (config.dashboards?.[d]) ok(`Dashboard ${d}: configured`);
    else warn(`Dashboard ${d} not set (run refresh-dashboards.js --setup)`);
  }

  return config;
}

// ─── Test 2: Bridge ─────────────────────────────────────────────────────────

function testBridge() {
  section('2. Notion Bridge');

  const candidates = [
    path.join(__dirname, '..', 'bridge.js'),
    path.join(os.homedir(), '.openclaw', 'workspace', 'app', 'skills', 'notion', 'bridge.js'),
  ];

  let bridge;
  for (const bp of candidates) {
    if (fs.existsSync(bp)) {
      bridge = require(bp);
      ok(`bridge.js found: ${bp}`);
      break;
    }
  }
  if (!bridge) { fail('bridge.js not found'); return null; }

  if (typeof bridge.request === 'function') ok('bridge.request is a function');
  else fail('bridge.request not found');

  // Check NOTION_TOKEN
  if (process.env.NOTION_TOKEN || process.env.NOTION_API_KEY) ok('Notion token in env');
  else {
    // bridge.js might have it hardcoded or from another source
    warn('NOTION_TOKEN not in env (bridge may have it internally)');
  }

  return bridge;
}

// ─── Test 3: Database Connectivity ──────────────────────────────────────────

async function testDatabases(config, bridge) {
  section('3. Database Connectivity');

  if (!config?.databases || !bridge) {
    fail('Skipping — config or bridge not available');
    return;
  }

  for (const [key, id] of Object.entries(config.databases)) {
    try {
      const db = await bridge.request('/databases/' + id, 'GET');
      const propCount = Object.keys(db.properties || {}).length;
      ok(`${key}: ${propCount} properties`);
      await new Promise(r => setTimeout(r, 350));
    } catch (e) {
      fail(`${key}: ${e.message.slice(0, 60)}`);
    }
  }
}

// ─── Test 4: Relations Audit ────────────────────────────────────────────────

async function testRelations(config, bridge) {
  section('4. Relations Audit');

  if (!config?.databases || !bridge) {
    fail('Skipping');
    return;
  }

  const expectedRelations = {
    units:    ['Ledger Entries', 'Expenses', 'Maintenance Requests', 'Communications'],
    ledger:   ['Unit'],
    expenses: ['Budget Line', 'Unit', 'Paid From'],
    maintenance: ['Unit', 'Related Expense'],
    works:    ['Linked Expenses'],
    cashPosition: [],
    movements: ['Account'],
    communications: ['Unit'],
    resolutions: ['Meeting'],
  };

  for (const [dbKey, expectedRels] of Object.entries(expectedRelations)) {
    const id = config.databases[dbKey];
    if (!id) continue;

    try {
      const db = await bridge.request('/databases/' + id, 'GET');
      const relations = Object.entries(db.properties)
        .filter(([, v]) => v.type === 'relation')
        .map(([k]) => k);

      for (const rel of expectedRels) {
        if (relations.some(r => r.toLowerCase().includes(rel.toLowerCase().split(' ')[0]))) {
          ok(`${dbKey} → ${rel}`);
        } else {
          warn(`${dbKey} missing relation: ${rel}`);
        }
      }
      await new Promise(r => setTimeout(r, 350));
    } catch (e) {
      fail(`${dbKey} relations check: ${e.message.slice(0, 60)}`);
    }
  }
}

// ─── Test 5: CLI Syntax ─────────────────────────────────────────────────────

function testCLI() {
  section('5. CLI Syntax Check');

  const scripts = ['condo-cli.js', 'setup.js', 'import-excel.js', 'owner-portal.js',
    'automations.js', 'refresh-dashboards.js', 'smoke-test.js'];

  for (const s of scripts) {
    const p = path.join(__dirname, s);
    if (!fs.existsSync(p)) { warn(`${s} not found`); continue; }
    try {
      execSync(`node -c "${p}"`, { stdio: 'pipe' });
      ok(`${s} — syntax valid`);
    } catch (e) {
      fail(`${s} — syntax error: ${e.message.slice(0, 80)}`);
    }
  }
}

// ─── Test 6: Data Anonymization Check ───────────────────────────────────────

function testAnonymization() {
  section('6. Anonymization Check');

  const sensitiveTerms = ['framboyant', 'guerin', 'metayer', 'ondella', 'facquet',
    'engel', 'santos', 'hazeltine', 'karina', 'patricia', 'gernot', 'frédéric',
    'serge', 'corine'];

  const filesToCheck = [
    'README.md', 'SKILL.md', 'config.example.json',
    'docs/index.html', 'docs/demo-video-script.md',
    'docs/gumroad-listing.md', 'docs/clawhub-free-skill.md',
  ];

  const skillDir = path.join(__dirname, '..');

  for (const f of filesToCheck) {
    const fp = path.join(skillDir, f);
    if (!fs.existsSync(fp)) { warn(`${f} not found`); continue; }
    const content = fs.readFileSync(fp, 'utf8').toLowerCase();
    let clean = true;
    for (const term of sensitiveTerms) {
      if (content.includes(term)) {
        fail(`${f} contains "${term}"`);
        clean = false;
      }
    }
    if (clean) ok(`${f} — clean`);
  }
}

// ─── Test 7: Dependencies ───────────────────────────────────────────────────

function testDependencies() {
  section('7. Dependencies');

  const deps = ['grammy', 'xlsx'];
  for (const dep of deps) {
    try {
      require.resolve(dep);
      ok(`${dep} installed`);
    } catch (e) {
      fail(`${dep} not installed (npm install ${dep})`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏢 CONDO MANAGER OS — SMOKE TEST SUITE\n');

  const config = testConfig();
  const bridge = testBridge();
  testCLI();
  testAnonymization();
  testDependencies();

  if (bridge && config?.databases) {
    await testDatabases(config, bridge);
    await testRelations(config, bridge);
  }

  // Summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  RESULTS: ✅ ${passed} passed | ❌ ${failed} failed | ⚠️  ${warned} warnings`);
  console.log(`${'═'.repeat(50)}\n`);

  if (failed > 0) {
    console.log('❌ Some tests failed. Fix issues above before releasing.');
    process.exit(1);
  } else if (warned > 0) {
    console.log('⚠️  All critical tests passed, but there are warnings to review.');
  } else {
    console.log('✅ All tests passed! Ready to ship.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
