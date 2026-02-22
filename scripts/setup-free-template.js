#!/usr/bin/env node
// =============================================================================
// Condo Manager OS — Free Notion Template Creator
// Creates 3 databases (Units, Budget, Cash Position) as a standalone template
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RATE = 350;

async function api(fn) { await sleep(RATE); return fn(); }

async function createDB(parentId, title, icon, props) {
  const body = {
    parent: { type: 'page_id', page_id: parentId },
    title: [{ type: 'text', text: { content: title } }],
    icon: { type: 'emoji', emoji: icon },
    properties: props,
  };
  return api(() => request('/databases', 'POST', JSON.stringify(body)));
}

async function main() {
  const args = process.argv.slice(2);
  const parentId = args.find(a => !a.startsWith('--'));

  if (!parentId) {
    console.log(`
🏢 Condo Manager OS — Free Template Setup

Creates 3 databases for basic condo management:
  🏠 Units Registry — Track units, owners, ownership shares
  📋 Budget — Annual budget with quarterly breakdown  
  🏦 Cash Position — Bank accounts and petty cash

Usage: node setup-free-template.js <notion-page-id>

Steps:
  1. Create a page in Notion
  2. Share it with your Notion integration
  3. Copy the page ID from the URL
  4. Run this script with that ID

Want the full system? 17 commands, owner portal, automations, dashboards:
  🛒 https://casedamare.gumroad.com/condo-os
`);
    return;
  }

  console.log('\n🏢 Creating Condo Manager OS — Free Template\n');

  // 1. Units Registry
  console.log('  Creating 🏠 Units Registry...');
  const units = await createDB(parentId, '🏠 Units Registry', '🏠', {
    'Unit': { title: {} },
    'Owner Name': { rich_text: {} },
    'Owner Email': { email: {} },
    'Owner Phone': { phone_number: {} },
    'Ownership Share (%)': { number: { format: 'percent' } },
    'Lot Number': { rich_text: {} },
    'Area (m²)': { number: { format: 'number' } },
    'Cadastral Value': { number: { format: 'number' } },
    'Current Balance': { number: { format: 'number' } },
    'Fee Status': {
      select: {
        options: [
          { name: 'Current', color: 'green' },
          { name: 'Overdue 1-30', color: 'yellow' },
          { name: 'Overdue 31-60', color: 'orange' },
          { name: 'Overdue 61-90', color: 'red' },
          { name: 'Overdue 90+', color: 'red' },
        ]
      }
    },
    'Notes': { rich_text: {} },
  });
  console.log(`    ✅ ${units.id}`);

  // 2. Budget
  console.log('  Creating 📋 Budget...');
  const budget = await createDB(parentId, '📋 Budget', '📋', {
    'Line Item': { title: {} },
    'Category': {
      select: {
        options: [
          { name: 'Utilities', color: 'blue' },
          { name: 'Maintenance', color: 'green' },
          { name: 'Insurance', color: 'purple' },
          { name: 'Management', color: 'orange' },
          { name: 'Reserve Fund', color: 'yellow' },
          { name: 'Legal', color: 'red' },
          { name: 'Other', color: 'gray' },
        ]
      }
    },
    'Annual Budget': { number: { format: 'number' } },
    'Q1 Actual': { number: { format: 'number' } },
    'Q2 Actual': { number: { format: 'number' } },
    'Q3 Actual': { number: { format: 'number' } },
    'Q4 Actual': { number: { format: 'number' } },
    'Fiscal Year': { number: { format: 'number' } },
    'Notes': { rich_text: {} },
  });
  console.log(`    ✅ ${budget.id}`);

  // 3. Cash Position
  console.log('  Creating 🏦 Cash Position...');
  const cash = await createDB(parentId, '🏦 Cash Position', '🏦', {
    'Account': { title: {} },
    'Type': {
      select: {
        options: [
          { name: 'Bank Account', color: 'blue' },
          { name: 'Petty Cash', color: 'green' },
          { name: 'Reserve Fund', color: 'purple' },
        ]
      }
    },
    'Balance': { number: { format: 'number' } },
    'Bank Name': { rich_text: {} },
    'Account Number': { rich_text: {} },
    'Currency': { select: { options: [
      { name: 'DOP', color: 'green' },
      { name: 'USD', color: 'blue' },
      { name: 'EUR', color: 'purple' },
    ]}},
    'Last Updated': { date: {} },
    'Notes': { rich_text: {} },
  });
  console.log(`    ✅ ${cash.id}`);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ✅ Free Template Created!                                   ║
║                                                              ║
║  🏠 Units Registry: ${units.id}  ║
║  📋 Budget:         ${budget.id}  ║
║  🏦 Cash Position:  ${cash.id}  ║
║                                                              ║
║  Next: Add your units, budget lines, and bank accounts.      ║
║                                                              ║
║  Want the FULL system?                                       ║
║  • 11 databases (+ Ledger, Expenses, Maintenance, more)      ║
║  • 17 CLI commands (fees, payments, statements, reports)      ║
║  • Owner self-service portal (Telegram bot)                  ║
║  • 7 automation workflows                                    ║
║  • 5 live dashboards                                         ║
║  • Excel import                                              ║
║  • Trilingual (ES/EN/FR)                                     ║
║                                                              ║
║  🛒 Get Pro: https://casedamare.gumroad.com/condo-os        ║
╚══════════════════════════════════════════════════════════════╝
`);
}

main().catch(e => { console.error(e); process.exit(1); });
