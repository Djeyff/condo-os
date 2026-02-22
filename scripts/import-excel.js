#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Condo Manager OS — Excel Import Tool
// Migrate from spreadsheets to Notion databases
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Resolve bridge.js
let bridge;
try { bridge = require(path.join(__dirname, '..', 'bridge')); } catch(_) {
  bridge = require('/home/node/.openclaw/workspace/app/skills/notion/bridge');
}

// Load config
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
let config;
try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch(e) {
  console.error('❌ config.json not found. Run setup.js first.');
  process.exit(1);
}

const db = config.databases || {};
const DELAY = 350;
const wait = ms => new Promise(r => setTimeout(r, ms));

// ─── Date helpers ─────────────────────────────────────
function serialToDate(serial) {
  if (typeof serial !== 'number' || serial < 1000) return null;
  const d = new Date((serial - 25569) * 86400000);
  return d.toISOString().split('T')[0];
}

function getQuarter(dateStr) {
  const m = parseInt(dateStr.split('-')[1]);
  if (m <= 3) return 'Q1';
  if (m <= 6) return 'Q2';
  if (m <= 9) return 'Q3';
  return 'Q4';
}

function getYear(dateStr) {
  return parseInt(dateStr.split('-')[0]);
}

// ─── Classification helpers ───────────────────────────
function classifyLedgerType(desc) {
  const d = desc.toLowerCase();
  if (d.includes('pago ') || d.includes('pago por') || d.includes('deposito') || d.includes('transferencia') || d.includes('moneygram')) return 'Payment Received';
  if (d.includes('cargo 2%') || d.includes('cargo administrador') || d.includes('multa') || d.includes('alguacil') || d.includes('honorario') && d.includes('recordatorio')) return 'Late Fee';
  if (d.includes('pedido de fondo') || d.includes('cuota extraordinaria') || d.includes('pedido excepcional') || d.includes('voto elec') || d.includes('inscripcion de privilegio')) return 'Work Assessment';
  if (d.includes('trimestre') || d.includes('gastos común') || d.includes('gastos total')) return 'Fee Call';
  if (d.includes('rectificación') || d.includes('ajuste')) return 'Adjustment';
  if (d.includes('compra de') || d.includes('camion de agua') || d.includes('fuga') || d.includes('daños')) return 'Private Charge';
  return 'Fee Call';
}

function classifyLedgerCategory(desc) {
  const d = desc.toLowerCase();
  if (d.includes('pago ') || d.includes('deposito') || d.includes('transferencia') || d.includes('moneygram')) return 'Payment';
  if (d.includes('privilegio') || d.includes('alguacil') || d.includes('notificacion')) return 'Legal Fees';
  if (d.includes('cargo 2%') || d.includes('cargo administrador') || d.includes('multa') || d.includes('recordatorio')) return 'Penalties & Fees';
  if (d.includes('pedido de fondo') || d.includes('cuota extraordinaria') || d.includes('pedido excepcional') || d.includes('voto elec')) return 'Extraordinary Assessment';
  if (d.includes('trimestre') || d.includes('gastos común') || d.includes('gastos total')) return 'Common Charges';
  return 'Common Charges';
}

function classifyExpenseCategory(header) {
  const h = header.toLowerCase();
  if (h.includes('inapa') || h.includes('luz') || h.includes('electricidad') || h.includes('camion')) return 'Utilities';
  if (h.includes('jardinero') || h.includes('basura') || h.includes('limpieza') || h.includes('recogida')) return 'Cleaning';
  if (h.includes('reparacion') || h.includes('mantenimiento')) return 'Maintenance';
  if (h.includes('honorario') && !h.includes('extra')) return 'Management Fee';
  if (h.includes('honorario') && h.includes('extra')) return 'Management Fee';
  if (h.includes('cargo') || h.includes('bancario') || h.includes('impuesto')) return 'Bank Charges';
  if (h.includes('seguro') || h.includes('poliza')) return 'Insurance';
  if (h.includes('voto elec') || h.includes('instalacion') || h.includes('filtr')) return 'Capital Works';
  if (h.includes('inscripcion') || h.includes('rnc') || h.includes('privilegio')) return 'Legal & Compliance';
  if (h.includes('otros') || h.includes('cargo administrador')) return 'Penalties & Collections';
  return 'Other';
}

function classifyMovementCategory(desc) {
  const d = desc.toLowerCase();
  if (d.includes('saldo balance')) return 'Transfer';
  if (d.includes('honorario admin')) return 'Management Fee';
  if (d.includes('yile') || d.includes('jardinero')) return 'Cleaning';
  if (d.includes('luz') || d.includes('inapa') || d.includes('camion')) return 'Utilities';
  if (d.includes('recogida') || d.includes('basura') || d.includes('lora')) return 'Cleaning';
  if (d.includes('frits') || d.includes('zorica') || d.includes('crismar') || d.includes('reparacion') || d.includes('cotizacion')) return 'Capital Works';
  if (d.includes('cargo ') || d.includes('impuesto') || d.includes('membresia')) return 'Bank Charges';
  if (d.includes('seguro') || d.includes('poliza')) return 'Insurance';
  if (d.includes('retiro para')) return 'Transfer';
  if (d.includes('pago ') || d.includes('deposito')) return 'Owner Payment';
  return 'Other';
}

// ─── Import functions ─────────────────────────────────

async function importUnits(rows) {
  // Detect unit rows: look for patterns like "A-1", ownership percentages, m² values
  const units = [];
  let currentOwner = '';
  let currentUnit = '';
  let currentSize = 0;
  let currentPct = 0;
  const components = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const a = String(row[0] || '').trim();
    const b = String(row[1] || '').trim();

    // Owner line: name in col 0, unit ID in col 1
    if (a.length > 3 && b.match(/^[A-Z]-?\d+$/i)) {
      if (currentUnit && currentPct > 0) {
        units.push({ unit: currentUnit, owner: currentOwner, size: currentSize, pct: currentPct, components: [...components] });
      }
      currentOwner = a;
      currentUnit = b;
      currentSize = 0;
      currentPct = 0;
      components.length = 0;
      continue;
    }

    // Component line: type in col 1, lot# in col 2, m² in col 3
    if (!a && b && row[2] && typeof row[3] === 'number') {
      components.push({ type: b, lot: String(row[2]), size: row[3] });
      continue;
    }

    // Total line: m² in col 3, percentage in col 4 or 5
    if (!a && !b && typeof row[3] === 'number' && row[3] > 50) {
      currentSize = row[3];
      currentPct = row[4] || row[5] || 0;
      if (currentPct > 1) currentPct = currentPct / 100;
    }
  }
  // Last unit
  if (currentUnit && currentPct > 0) {
    units.push({ unit: currentUnit, owner: currentOwner, size: currentSize, pct: currentPct, components: [...components] });
  }

  if (units.length === 0) {
    console.log('⚠️  No units detected. Check sheet format.');
    return 0;
  }

  const totalPct = units.reduce((s, u) => s + u.pct, 0);
  console.log(`\nDetected ${units.length} units (total ownership: ${(totalPct * 100).toFixed(2)}%):`);
  for (const u of units) {
    console.log(`  ${u.unit} | ${u.owner.slice(0, 30)} | ${u.size} m² | ${(u.pct * 100).toFixed(2)}%`);
  }

  if (Math.abs(totalPct - 1) > 0.01) {
    console.log(`\n⚠️  WARNING: Ownership shares sum to ${(totalPct * 100).toFixed(2)}% (expected ~100%)`);
  }

  if (isDryRun) { console.log('\n[DRY RUN] No entries written.'); return units.length; }

  let count = 0;
  for (const u of units) {
    await wait(DELAY);
    const notes = u.components.map(c => `${c.type} ${c.lot}: ${c.size} m²`).join('\n');
    const props = {
      'Unit': { title: [{ text: { content: u.unit } }] },
      'Owner Name': { rich_text: [{ text: { content: u.owner } }] },
      'Ownership Share (%)': { number: u.pct },
      'Size': { number: u.size },
    };
    if (notes) props['Notes'] = { rich_text: [{ text: { content: notes.slice(0, 2000) } }] };
    try {
      await bridge.addPage({ database_id: db.units }, props);
      count++;
      process.stdout.write('.');
    } catch(e) {
      console.log(`\n❌ ${u.unit}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`\n✅ ${count} units imported`);
  return count;
}

async function importLedger(rows, unitPageIds) {
  // Detect unit sections, then import entries
  let currentUnit = null;
  let entries = [];
  const MIN_DATE = 45000; // ~2023

  for (const row of rows) {
    if (!row) continue;
    const a = String(row[0] || '').trim();
    const b = String(row[1] || '').trim();

    // Unit header detection
    const unitMatch = a.match(/(?:apartamento|unit)\s+([A-Z]-?\d+)/i) || b.match(/([A-Z]-?\d+)/i);
    if (a.match(/^apartamento/i) || (a.length > 3 && a.match(/^[A-Z]-?\d+$/))) {
      currentUnit = a.match(/[A-Z]-?\d+/i)?.[0] || a;
      continue;
    }

    if (!currentUnit) continue;

    // Entry line: description, date serial, debit, credit, balance
    const desc = b || a;
    const dateSerial = row[2] || row[1];
    const debit = row[3];
    const credit = row[4];
    const balance = row[5];

    if (!desc || desc.length < 3) continue;
    if (typeof dateSerial !== 'number' || dateSerial < MIN_DATE) continue;
    if (desc.includes('SALDO ANTERIOR') || desc.includes('BALANCE AL') || desc.includes('TOTAL')) continue;

    const date = serialToDate(dateSerial);
    if (!date) continue;

    entries.push({
      unit: currentUnit.replace(/(\w)(\d)/, '$1-$2').toUpperCase(),
      desc: desc.slice(0, 100),
      date,
      debit: typeof debit === 'number' ? Math.abs(debit) : 0,
      credit: typeof credit === 'number' ? Math.abs(credit) : 0,
      balance: typeof balance === 'number' ? balance : null,
      type: classifyLedgerType(desc),
      category: classifyLedgerCategory(desc),
      year: getYear(date),
    });
  }

  if (entries.length === 0) {
    console.log('⚠️  No ledger entries detected.');
    return 0;
  }

  const byUnit = {};
  for (const e of entries) { (byUnit[e.unit] = byUnit[e.unit] || []).push(e); }
  console.log(`\nDetected ${entries.length} ledger entries across ${Object.keys(byUnit).length} units:`);
  for (const [unit, ents] of Object.entries(byUnit)) {
    console.log(`  ${unit}: ${ents.length} entries`);
  }

  if (isDryRun) { console.log('\n[DRY RUN] No entries written.'); return entries.length; }

  let count = 0, errors = 0;
  for (const e of entries) {
    await wait(DELAY);
    const props = {
      'Entry': { title: [{ text: { content: `${e.unit} — ${e.desc}` } }] },
      'Date': { date: { start: e.date } },
      'Type': { select: { name: e.type } },
      'Category': { select: { name: e.category } },
      'Fiscal Year': { number: e.year },
    };
    if (e.debit) props['Debit'] = { number: e.debit };
    if (e.credit) props['Credit'] = { number: e.credit };
    if (e.balance !== null) props['Balance After'] = { number: e.balance };

    // Link to unit if we have page IDs
    if (unitPageIds && unitPageIds[e.unit]) {
      props['Unit'] = { relation: [{ id: unitPageIds[e.unit] }] };
    }

    try {
      await bridge.addPage({ database_id: db.ledger }, props);
      count++;
      process.stdout.write('.');
    } catch(err) {
      errors++;
      if (errors <= 3) console.log(`\n❌ ${e.desc.slice(0, 40)}: ${err.message.slice(0, 60)}`);
    }
  }
  console.log(`\n✅ ${count} ledger entries imported | ${errors} errors`);
  return count;
}

async function importExpenses(rows) {
  let currentHeader = '';
  let entries = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const a = String(row[0] || '').trim();
    const b = row[1];
    const c = row[2];

    // Category header: text in col 0, no number in col 1
    if (a.length > 3 && !a.includes('Total') && !a.includes('TOTAL') && !a.includes('Estado') && !a.includes('CONDOMINIO') && typeof b !== 'number') {
      currentHeader = a;
      continue;
    }

    // Expense line: description in col 0, date serial in col 1, amount in col 2
    if (a.length > 3 && typeof b === 'number' && typeof c === 'number' && !a.includes('Total') && !a.includes('TOTAL')) {
      const date = serialToDate(b);
      if (!date) continue;
      entries.push({
        desc: a.slice(0, 100),
        date,
        amount: Math.abs(c),
        category: classifyExpenseCategory(currentHeader),
        quarter: getQuarter(date),
        year: getYear(date),
        header: currentHeader,
      });
    }
  }

  if (entries.length === 0) {
    console.log('⚠️  No expenses detected.');
    return 0;
  }

  const byCat = {};
  for (const e of entries) { (byCat[e.category] = byCat[e.category] || []).push(e); }
  console.log(`\nDetected ${entries.length} expenses:`);
  for (const [cat, ents] of Object.entries(byCat)) {
    const total = ents.reduce((s, e) => s + e.amount, 0);
    console.log(`  ${cat}: ${ents.length} entries (${total.toLocaleString()} ${config.building?.currency || 'DOP'})`);
  }

  if (isDryRun) { console.log('\n[DRY RUN] No entries written.'); return entries.length; }

  let count = 0, errors = 0;
  for (const e of entries) {
    await wait(DELAY);
    const props = {
      'Description': { title: [{ text: { content: e.desc } }] },
      'Amount': { number: e.amount },
      'Date': { date: { start: e.date } },
      'Category': { select: { name: e.category } },
      'Status': { select: { name: 'Paid' } },
      'Fiscal Year': { number: e.year },
      'Quarter': { select: { name: e.quarter } },
    };
    try {
      await bridge.addPage({ database_id: db.expenses }, props);
      count++;
      process.stdout.write('.');
    } catch(err) {
      errors++;
      if (errors <= 3) console.log(`\n❌ ${e.desc.slice(0, 40)}: ${err.message.slice(0, 60)}`);
    }
  }
  console.log(`\n✅ ${count} expenses imported | ${errors} errors`);
  return count;
}

async function importMovements(rows, accountPageIds) {
  // Detect side-by-side format: Caja Chica (cols 1-5) and Banco Popular (cols 8-12)
  // Also detect single-account format (Fondo de Reservas)
  const entries = [];
  let hasSideBySide = false;
  let isFondo = false;

  // Check if it's a side-by-side sheet or single account
  for (const row of rows) {
    if (!row) continue;
    const r = row.map(c => String(c || '').toLowerCase());
    if (r.some(c => c.includes('caja chica')) && r.some(c => c.includes('banco'))) hasSideBySide = true;
    if (r.some(c => c.includes('fondo de reservas'))) isFondo = true;
  }

  if (hasSideBySide) {
    // Parse both accounts
    for (const [colOffset, acctKey] of [[1, 'cajaChica'], [8, 'bancoPopular']]) {
      let balance = 0;
      for (const row of rows) {
        if (!row) continue;
        const desc = String(row[colOffset] || '').trim();
        const dateSerial = row[colOffset + 1];
        const debit = row[colOffset + 3];
        const credit = row[colOffset + 4];

        if (!desc || desc.length < 3 || desc === 'Descripción') continue;
        if (desc.includes('TOTAL') || desc.includes('BALANCE AL') || desc.includes('Saldo banco') || desc.includes('Saldo efectivo') || desc.includes('Estado ')) continue;
        if (typeof dateSerial !== 'number') continue;

        const date = serialToDate(dateSerial);
        if (!date) continue;

        let movement, amount;
        if (desc.includes('Saldo balance')) {
          movement = 'Opening Balance';
          balance = credit || 0;
          amount = balance;
        } else if (credit && credit > 0) {
          movement = 'Credit';
          balance += credit;
          amount = Math.abs(credit);
        } else {
          movement = 'Debit';
          balance += (debit || 0);
          amount = Math.abs(debit || 0);
        }

        entries.push({
          desc: desc.slice(0, 100), date, movement, amount,
          balance: Math.round(balance * 100) / 100,
          category: classifyMovementCategory(desc),
          year: getYear(date), accountKey: acctKey,
        });
      }
    }
  }

  if (isFondo) {
    let balance = 0;
    for (const row of rows) {
      if (!row) continue;
      const desc = String(row[1] || '').trim();
      const dateSerial = row[2];
      const debit = row[4];
      const credit = row[5];

      if (!desc || desc.length < 3 || desc === 'Descripción' || desc.includes('FONDO DE RESERVAS')) continue;
      if (typeof dateSerial !== 'number') continue;

      const date = serialToDate(dateSerial);
      if (!date) continue;

      let movement, amount;
      if (desc.includes('Saldo balance')) {
        movement = 'Opening Balance';
        balance = credit || 0;
        amount = balance;
      } else if (debit && debit < 0) {
        movement = 'Debit';
        balance += debit;
        amount = Math.abs(debit);
      } else if (credit && credit > 0) {
        movement = 'Credit';
        balance += credit;
        amount = credit;
      } else continue;

      entries.push({
        desc: desc.slice(0, 100), date, movement, amount,
        balance: Math.round(balance * 100) / 100,
        category: classifyMovementCategory(desc),
        year: getYear(date), accountKey: 'fondoReservas',
      });
    }
  }

  if (entries.length === 0) {
    console.log('⚠️  No account movements detected.');
    return 0;
  }

  const byAcct = {};
  for (const e of entries) { (byAcct[e.accountKey] = byAcct[e.accountKey] || []).push(e); }
  console.log(`\nDetected ${entries.length} movements:`);
  for (const [acct, ents] of Object.entries(byAcct)) {
    const last = ents[ents.length - 1];
    console.log(`  ${acct}: ${ents.length} entries (closing: ${last?.balance?.toLocaleString()})`);
  }

  if (isDryRun) { console.log('\n[DRY RUN] No entries written.'); return entries.length; }

  let count = 0, errors = 0;
  for (const e of entries) {
    await wait(DELAY);
    const props = {
      'Description': { title: [{ text: { content: e.desc } }] },
      'Date': { date: { start: e.date } },
      'Movement': { select: { name: e.movement } },
      'Amount': { number: e.amount },
      'Balance After': { number: e.balance },
      'Category': { select: { name: e.category } },
      'Fiscal Year': { number: e.year },
    };
    // Link to account if we have page IDs
    const acctId = accountPageIds?.[e.accountKey];
    if (acctId) props['Account'] = { relation: [{ id: acctId }] };

    try {
      await bridge.addPage({ database_id: db.movements }, props);
      count++;
      process.stdout.write('.');
    } catch(err) {
      errors++;
      if (errors <= 3) console.log(`\n❌ ${e.desc.slice(0, 40)}: ${err.message.slice(0, 60)}`);
    }
  }
  console.log(`\n✅ ${count} movements imported | ${errors} errors`);
  return count;
}

async function importBudget(rows) {
  const entries = [];
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const a = String(row[0] || '').trim();
    // Budget lines: category name, annual amount
    // Typically: col 0 = category, col 1 = monthly, col 2 = annual (or varies)
    if (a.length > 3 && !a.includes('Total') && !a.includes('TOTAL') && !a.includes('Presupuesto') && !a.includes('CONDOMINIO')) {
      // Find the first number that could be an annual amount
      for (let i = 1; i < row.length; i++) {
        if (typeof row[i] === 'number' && row[i] > 100) {
          entries.push({
            category: a.slice(0, 80),
            annual: row[i],
            department: classifyExpenseCategory(a),
          });
          break;
        }
      }
    }
  }

  if (entries.length === 0) {
    console.log('⚠️  No budget entries detected.');
    return 0;
  }

  const total = entries.reduce((s, e) => s + e.annual, 0);
  console.log(`\nDetected ${entries.length} budget lines (total: ${total.toLocaleString()}):`);
  for (const e of entries) {
    console.log(`  ${e.category}: ${e.annual.toLocaleString()} (${e.department})`);
  }

  if (isDryRun) { console.log('\n[DRY RUN] No entries written.'); return entries.length; }

  let count = 0;
  for (const e of entries) {
    await wait(DELAY);
    try {
      await bridge.addPage({ database_id: db.budget }, {
        'Category': { title: [{ text: { content: e.category } }] },
        'Annual Budget': { number: e.annual },
        'Department': { select: { name: e.department } },
        'Status': { select: { name: 'On Track' } },
      });
      count++;
      process.stdout.write('.');
    } catch(err) {
      console.log(`\n❌ ${e.category}: ${err.message.slice(0, 60)}`);
    }
  }
  console.log(`\n✅ ${count} budget lines imported`);
  return count;
}

// ─── Sheet auto-detection ─────────────────────────────
function detectSheetType(name, rows) {
  const n = name.toLowerCase();
  if (n.includes('distribución') || n.includes('distribucion') || n.includes('units') || n.includes('propietario')) return 'units';
  if (n.includes('presupuesto') || n.includes('budget')) return 'budget';
  if (n.includes('gastos detall') || n.includes('expense')) return 'expenses';
  if (n.includes('cierre-prop') || n.includes('ledger')) return 'ledger';
  if (n.includes('caja chica') || n.includes('banco') || n.includes('fondo de reserva')) return 'movements';
  if (n.match(/^a\d$/i)) return 'ledger'; // Individual unit sheets (A1, A2, etc.)
  return null;
}

// ─── Main ─────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    flags[k] = v || true;
  } else {
    positional.push(arg);
  }
}

const isDryRun = !!flags['dry-run'];
const forceType = flags.type;
const forceSheet = flags.sheet;

if (positional.length === 0 || flags.help) {
  console.log(`
🏢 Condo Manager OS — Excel Import Tool

Usage:
  node import-excel.js <file.xlsx> [options]

Options:
  --type=units|ledger|expenses|movements|budget   Force import type
  --sheet=<name>                                  Import specific sheet only
  --dry-run                                       Preview without writing
  --help                                          Show this help

Auto-detection:
  Sheet names are analyzed to determine import type.
  "Distribución" → units, "Gastos detallados" → expenses,
  "A1"-"A7" → ledger, "Caja Chica" → movements, etc.

Examples:
  node import-excel.js financials.xlsx --dry-run
  node import-excel.js data.xlsx --type=expenses --sheet="Gastos detallados"
  node import-excel.js migration.xlsx
`);
  process.exit(0);
}

const filePath = positional[0];
if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

async function main() {
  let XLSX;
  try { XLSX = require('xlsx'); } catch(_) {
    console.error('❌ xlsx package not found. Install: npm install xlsx');
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath);
  console.log(`\n📊 File: ${path.basename(filePath)}`);
  console.log(`📋 Sheets: ${wb.SheetNames.join(', ')}`);

  const sheetsToProcess = forceSheet
    ? [forceSheet]
    : wb.SheetNames;

  let totalImported = 0;

  for (const sheetName of sheetsToProcess) {
    if (!wb.Sheets[sheetName]) {
      console.log(`⚠️  Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(', ')}`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    const type = forceType || detectSheetType(sheetName, rows);

    if (!type) {
      console.log(`\n⏭️  Skipping "${sheetName}" (unrecognized format)`);
      continue;
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📥 Importing "${sheetName}" as: ${type}`);
    console.log('═'.repeat(50));

    switch (type) {
      case 'units':
        totalImported += await importUnits(rows);
        break;
      case 'ledger':
        totalImported += await importLedger(rows);
        break;
      case 'expenses':
        totalImported += await importExpenses(rows);
        break;
      case 'movements':
        totalImported += await importMovements(rows);
        break;
      case 'budget':
        totalImported += await importBudget(rows);
        break;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Import complete: ${totalImported} total entries${isDryRun ? ' (DRY RUN)' : ''}`);
  console.log('═'.repeat(50));
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
