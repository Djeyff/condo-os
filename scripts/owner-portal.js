#!/usr/bin/env node
// =============================================================================
// Condo Manager OS — Owner Portal (Telegram Bot)
// =============================================================================
// A self-service portal for condo owners via Telegram.
// Owners authenticate with their unit number, then can:
//   - Check balance
//   - View account statement
//   - Submit maintenance requests
//   - See upcoming meetings & resolutions
//   - View building announcements
//   - Contact administration
//
// Usage:
//   PORTAL_BOT_TOKEN=xxx node owner-portal.js
//   Or set portalBotToken in config.json
//
// Each owner registers once by sending /start and entering their unit + PIN.
// PINs are stored in config.json under "portal.pins" (admin sets them).
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Load .env from skill root
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

const { Bot, InlineKeyboard, InputFile } = require('grammy');

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
  console.error('✗ Cannot read config.json at', CONFIG_PATH);
  process.exit(1);
}

const DB       = config.databases || {};
const BUILDING = config.building  || {};
const CURRENCY = BUILDING.currency || 'DOP';
const BOT_TOKEN = process.env.PORTAL_BOT_TOKEN || config.portal?.botToken;

if (!BOT_TOKEN) {
  console.error('✗ No bot token. Set PORTAL_BOT_TOKEN env or portal.botToken in config.json');
  process.exit(1);
}

// Portal settings
const PORTAL   = config.portal || {};
const PINS     = PORTAL.pins || {};        // { "A-1": "1234", "A-2": "5678", ... }
const ADMIN_ID = PORTAL.adminChatId || null; // Telegram chat ID of the admin
const LANG     = PORTAL.defaultLang || 'es';

// ─────────────────────────────────────────────────────────────────────────────
// Bridge (Notion API)
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
  console.error('✗ Cannot find bridge.js');
  process.exit(1);
}

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
  if (p.type === 'formula') return p.formula?.type === 'number' ? p.formula.number : null;
  if (p.type === 'rollup')  return p.rollup?.type === 'number' ? p.rollup.number : null;
  return null;
}
function getText(page, key) {
  const p = page?.properties?.[key];
  if (!p) return '';
  if (p.type === 'rich_text') return (p.rich_text || []).map(t => t.plain_text).join('');
  if (p.type === 'title')     return (p.title || []).map(t => t.plain_text).join('');
  if (p.type === 'email')     return p.email || '';
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
  if (n === null || n === undefined) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}${fmt(n)} ${CURRENCY}`;
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d.length === 10 ? d + 'T12:00:00Z' : d);
  return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Store (in-memory — maps Telegram user ID → unit)
// Persisted to a JSON file so restarts don't lose auth
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_FILE = path.join(path.dirname(CONFIG_PATH), 'portal-sessions.json');
let sessions = {}; // { telegramUserId: { unit: 'A-1', unitPageId: '...', authenticated: true } }

try {
  if (fs.existsSync(SESSION_FILE)) {
    sessions = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  }
} catch (e) { /* start fresh */ }

function saveSession() {
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2)); } catch (e) {}
}

function getSession(userId) {
  return sessions[String(userId)] || null;
}

function setSession(userId, data) {
  sessions[String(userId)] = data;
  saveSession();
}

function clearSession(userId) {
  delete sessions[String(userId)];
  saveSession();
}

// ─────────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  es: {
    welcome: '🏢 *Bienvenido al Portal de Propietarios*\n\n' +
      `Edificio: *${BUILDING.name || 'Tu Edificio'}*\n\n` +
      'Para acceder, necesita su número de unidad y PIN.\n' +
      'Envíe su número de unidad (ej: A-1):',
    enterPin: '🔑 Ingrese su PIN de 4 dígitos:',
    wrongPin: '❌ PIN incorrecto. Intente de nuevo o contacte al administrador.',
    wrongUnit: '❌ Unidad no encontrada. Verifique e intente de nuevo.',
    authenticated: '✅ *Autenticado como unidad {unit}*\n\nBienvenido, {owner}!',
    menu: '📋 *Menú Principal — Unidad {unit}*\n\nSeleccione una opción:',
    balance: '💰 *Balance — Unidad {unit}*\n\n' +
      'Propietario: {owner}\n' +
      'Balance actual: *{balance}*\n' +
      'Estado: {status}\n' +
      'Último pago: {lastPayment}\n' +
      'Cuota trimestral: {quarterlyFee}',
    noLedger: '📭 No hay movimientos registrados.',
    statement: '📊 *Estado de Cuenta — Unidad {unit}*\n\nÚltimos {count} movimientos:\n\n',
    stmtLine: '{date} | {type} | {desc}\n{debit}{credit} → Saldo: {balance}\n',
    maintenance: '🔧 *Solicitud de Mantenimiento*\n\nDescriaba el problema:',
    maintenanceLocation: '📍 ¿Dónde está el problema? (ej: Baño principal, cocina):',
    maintenancePriority: '⚡ Seleccione la prioridad:',
    maintenanceSubmitted: '✅ *Solicitud #{id} registrada*\n\n' +
      'Problema: {desc}\n' +
      'Ubicación: {location}\n' +
      'Prioridad: {priority}\n\n' +
      'Recibirá actualizaciones aquí.',
    meetings: '📅 *Próximas Reuniones*\n\n',
    noMeetings: '📅 No hay reuniones programadas.',
    announcements: '📢 *Últimas Comunicaciones*\n\n',
    noAnnouncements: '📢 No hay comunicaciones recientes.',
    contact: '📞 *Contactar Administración*\n\n' +
      'Para consultas, escriba su mensaje aquí y será reenviado al administrador.',
    contactSent: '✅ Mensaje enviado al administrador. Le responderán pronto.',
    contactNoAdmin: '⚠️ El administrador no está configurado. Contacte directamente.',
    logout: '👋 Sesión cerrada. Envíe /start para volver a acceder.',
    btnBalance: '💰 Balance',
    btnStatement: '📊 Estado de Cuenta',
    btnMaintenance: '🔧 Solicitar Mantenimiento',
    btnMeetings: '📅 Reuniones',
    btnAnnouncements: '📢 Comunicaciones',
    btnContact: '📞 Contactar Admin',
    btnLogout: '🚪 Cerrar Sesión',
    btnBack: '⬅️ Menú Principal',
    balancePositive: '✅ Al día',
    balanceNegative: '🔴 Pendiente',
  },
  en: {
    welcome: '🏢 *Welcome to the Owner Portal*\n\n' +
      `Building: *${BUILDING.name || 'Your Building'}*\n\n` +
      'To access, you need your unit number and PIN.\n' +
      'Send your unit number (e.g. A-1):',
    enterPin: '🔑 Enter your 4-digit PIN:',
    wrongPin: '❌ Wrong PIN. Try again or contact administration.',
    wrongUnit: '❌ Unit not found. Check and try again.',
    authenticated: '✅ *Authenticated as unit {unit}*\n\nWelcome, {owner}!',
    menu: '📋 *Main Menu — Unit {unit}*\n\nSelect an option:',
    balance: '💰 *Balance — Unit {unit}*\n\n' +
      'Owner: {owner}\n' +
      'Current balance: *{balance}*\n' +
      'Status: {status}\n' +
      'Last payment: {lastPayment}\n' +
      'Quarterly fee: {quarterlyFee}',
    noLedger: '📭 No transactions recorded.',
    statement: '📊 *Account Statement — Unit {unit}*\n\nLast {count} transactions:\n\n',
    stmtLine: '{date} | {type} | {desc}\n{debit}{credit} → Balance: {balance}\n',
    maintenance: '🔧 *Maintenance Request*\n\nDescribe the issue:',
    maintenanceLocation: '📍 Where is the problem? (e.g. Master bathroom, kitchen):',
    maintenancePriority: '⚡ Select priority:',
    maintenanceSubmitted: '✅ *Request #{id} submitted*\n\n' +
      'Issue: {desc}\n' +
      'Location: {location}\n' +
      'Priority: {priority}\n\n' +
      'You will receive updates here.',
    meetings: '📅 *Upcoming Meetings*\n\n',
    noMeetings: '📅 No meetings scheduled.',
    announcements: '📢 *Latest Communications*\n\n',
    noAnnouncements: '📢 No recent communications.',
    contact: '📞 *Contact Administration*\n\n' +
      'Type your message here and it will be forwarded to the administrator.',
    contactSent: '✅ Message sent to administrator. They will respond soon.',
    contactNoAdmin: '⚠️ Administrator not configured. Please contact directly.',
    logout: '👋 Session closed. Send /start to log in again.',
    btnBalance: '💰 Balance',
    btnStatement: '📊 Statement',
    btnMaintenance: '🔧 Maintenance Request',
    btnMeetings: '📅 Meetings',
    btnAnnouncements: '📢 Announcements',
    btnContact: '📞 Contact Admin',
    btnLogout: '🚪 Logout',
    btnBack: '⬅️ Main Menu',
    balancePositive: '✅ Current',
    balanceNegative: '🔴 Overdue',
  },
  fr: {
    welcome: '🏢 *Bienvenue sur le Portail Propriétaires*\n\n' +
      `Immeuble: *${BUILDING.name || 'Votre Immeuble'}*\n\n` +
      'Pour accéder, vous avez besoin de votre numéro d\'unité et PIN.\n' +
      'Envoyez votre numéro d\'unité (ex: A-1):',
    enterPin: '🔑 Entrez votre PIN à 4 chiffres:',
    wrongPin: '❌ PIN incorrect. Réessayez ou contactez l\'administration.',
    wrongUnit: '❌ Unité non trouvée. Vérifiez et réessayez.',
    authenticated: '✅ *Authentifié en tant qu\'unité {unit}*\n\nBienvenue, {owner}!',
    menu: '📋 *Menu Principal — Unité {unit}*\n\nSélectionnez une option:',
    balance: '💰 *Solde — Unité {unit}*\n\n' +
      'Propriétaire: {owner}\n' +
      'Solde actuel: *{balance}*\n' +
      'Statut: {status}\n' +
      'Dernier paiement: {lastPayment}\n' +
      'Charges trimestrielles: {quarterlyFee}',
    noLedger: '📭 Aucun mouvement enregistré.',
    statement: '📊 *Relevé de Compte — Unité {unit}*\n\nDerniers {count} mouvements:\n\n',
    stmtLine: '{date} | {type} | {desc}\n{debit}{credit} → Solde: {balance}\n',
    maintenance: '🔧 *Demande de Maintenance*\n\nDécrivez le problème:',
    maintenanceLocation: '📍 Où se trouve le problème? (ex: Salle de bain, cuisine):',
    maintenancePriority: '⚡ Sélectionnez la priorité:',
    maintenanceSubmitted: '✅ *Demande #{id} enregistrée*\n\n' +
      'Problème: {desc}\n' +
      'Emplacement: {location}\n' +
      'Priorité: {priority}\n\n' +
      'Vous recevrez des mises à jour ici.',
    meetings: '📅 *Prochaines Réunions*\n\n',
    noMeetings: '📅 Aucune réunion prévue.',
    announcements: '📢 *Dernières Communications*\n\n',
    noAnnouncements: '📢 Aucune communication récente.',
    contact: '📞 *Contacter l\'Administration*\n\n' +
      'Tapez votre message ici et il sera transmis à l\'administrateur.',
    contactSent: '✅ Message envoyé à l\'administrateur. Il vous répondra bientôt.',
    contactNoAdmin: '⚠️ Administrateur non configuré. Veuillez contacter directement.',
    logout: '👋 Session fermée. Envoyez /start pour vous reconnecter.',
    btnBalance: '💰 Solde',
    btnStatement: '📊 Relevé',
    btnMaintenance: '🔧 Demande Maintenance',
    btnMeetings: '📅 Réunions',
    btnAnnouncements: '📢 Communications',
    btnContact: '📞 Contacter Admin',
    btnLogout: '🚪 Déconnexion',
    btnBack: '⬅️ Menu Principal',
    balancePositive: '✅ À jour',
    balanceNegative: '🔴 Impayé',
  },
};

function t(key, lang = LANG) {
  return (T[lang] || T.es)[key] || (T.es)[key] || key;
}

function fill(template, vars) {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit lookup cache
// ─────────────────────────────────────────────────────────────────────────────

let unitCache = null;
let unitCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getUnits() {
  if (unitCache && Date.now() - unitCacheTime < CACHE_TTL) return unitCache;
  const pages = await queryAll(DB.units);
  unitCache = pages.filter(p => getTitle(p) && getTitle(p) !== '(template)');
  unitCacheTime = Date.now();
  return unitCache;
}

async function findUnit(unitName) {
  const units = await getUnits();
  const norm = unitName.trim().toUpperCase().replace(/^([A-Z]+)-?(\d+)$/, '$1-$2');
  return units.find(u => getTitle(u).toUpperCase() === norm) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation state (for multi-step flows like maintenance requests)
// ─────────────────────────────────────────────────────────────────────────────

const convState = {}; // { chatId: { step: 'maintenance_desc', data: {} } }

// ─────────────────────────────────────────────────────────────────────────────
// Bot Setup
// ─────────────────────────────────────────────────────────────────────────────

const bot = new Bot(BOT_TOKEN);

function mainMenuKeyboard(lang) {
  return new InlineKeyboard()
    .text(t('btnBalance', lang),       'balance').row()
    .text(t('btnStatement', lang),     'statement').row()
    .text(t('btnMaintenance', lang),   'maintenance').row()
    .text(t('btnMeetings', lang),      'meetings')
    .text(t('btnAnnouncements', lang), 'announcements').row()
    .text(t('btnContact', lang),       'contact')
    .text(t('btnLogout', lang),        'logout');
}

function backKeyboard(lang) {
  return new InlineKeyboard().text(t('btnBack', lang), 'menu');
}

// ── /start — Authentication flow ────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  // Clear any existing session
  clearSession(userId);
  delete convState[ctx.chat.id];

  convState[ctx.chat.id] = { step: 'auth_unit' };
  await ctx.reply(t('welcome'), { parse_mode: 'Markdown' });
});

bot.command('menu', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session?.authenticated) {
    return ctx.reply('Send /start to log in first.');
  }
  await sendMenu(ctx, session);
});

bot.command('lang', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session) return;
  const newLang = ctx.message.text.split(' ')[1]?.toLowerCase();
  if (['es', 'en', 'fr'].includes(newLang)) {
    session.lang = newLang;
    setSession(ctx.from.id, session);
    await ctx.reply(`Language set to: ${newLang}`);
    if (session.authenticated) await sendMenu(ctx, session);
  } else {
    await ctx.reply('Usage: /lang es|en|fr');
  }
});

// ── Send main menu ─────────────────────────────────────────────────────────

async function sendMenu(ctx, session) {
  const lang = session.lang || LANG;
  const text = fill(t('menu', lang), { unit: session.unit });
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: mainMenuKeyboard(lang),
  });
}

// ── Callback query handler ──────────────────────────────────────────────────

bot.on('callback_query:data', async (ctx) => {
  const userId = ctx.from.id;
  const session = getSession(userId);
  const action = ctx.callbackQuery.data;

  await ctx.answerCallbackQuery();

  if (!session?.authenticated && action !== 'menu') {
    return ctx.reply('Send /start to log in first.');
  }

  const lang = session?.lang || LANG;

  switch (action) {
    case 'menu':
      return sendMenu(ctx, session);

    case 'balance':
      return handleBalance(ctx, session);

    case 'statement':
      return handleStatement(ctx, session);

    case 'maintenance':
      return handleMaintenanceStart(ctx, session);

    case 'meetings':
      return handleMeetings(ctx, session);

    case 'announcements':
      return handleAnnouncements(ctx, session);

    case 'contact':
      return handleContactStart(ctx, session);

    case 'logout':
      clearSession(userId);
      delete convState[ctx.chat.id];
      return ctx.reply(t('logout', lang));

    // Maintenance priority callbacks
    case 'priority_emergency':
    case 'priority_high':
    case 'priority_medium':
    case 'priority_low':
      return handleMaintenancePriority(ctx, session, action.replace('priority_', ''));

    default:
      return ctx.reply('Unknown action');
  }
});

// ── Text message handler (for multi-step flows + auth) ──────────────────────

bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const text   = ctx.message.text.trim();
  const state  = convState[chatId];

  if (!state) {
    // Not in a flow — check if authenticated and show menu
    const session = getSession(userId);
    if (session?.authenticated) {
      return sendMenu(ctx, session);
    }
    return ctx.reply('Send /start to begin.');
  }

  switch (state.step) {
    // ── Auth flow ───────────────────────────────────────────────────────
    case 'auth_unit': {
      const unit = await findUnit(text);
      if (!unit) {
        return ctx.reply(t('wrongUnit'));
      }
      const unitName = getTitle(unit);

      // If no PINs configured, auto-authenticate (demo mode)
      if (!PINS[unitName] && Object.keys(PINS).length === 0) {
        const owner = getText(unit, 'Owner Name');
        const session = {
          unit: unitName,
          unitPageId: unit.id,
          owner,
          authenticated: true,
          lang: LANG,
        };
        setSession(userId, session);
        delete convState[chatId];
        await ctx.reply(fill(t('authenticated'), { unit: unitName, owner }), { parse_mode: 'Markdown' });
        return sendMenu(ctx, session);
      }

      // PIN required
      state.step = 'auth_pin';
      state.unitName = unitName;
      state.unitPageId = unit.id;
      state.owner = getText(unit, 'Owner Name');
      state.attempts = 0;
      return ctx.reply(t('enterPin'));
    }

    case 'auth_pin': {
      const correctPin = PINS[state.unitName];
      if (text === correctPin) {
        const session = {
          unit: state.unitName,
          unitPageId: state.unitPageId,
          owner: state.owner,
          authenticated: true,
          lang: LANG,
        };
        setSession(userId, session);
        delete convState[chatId];
        await ctx.reply(fill(t('authenticated'), { unit: state.unitName, owner: state.owner }), { parse_mode: 'Markdown' });
        return sendMenu(ctx, session);
      }
      state.attempts++;
      if (state.attempts >= 3) {
        delete convState[chatId];
        return ctx.reply('🔒 Too many attempts. Send /start to try again.');
      }
      return ctx.reply(t('wrongPin'));
    }

    // ── Maintenance flow ────────────────────────────────────────────────
    case 'maintenance_desc': {
      state.data.description = text;
      state.step = 'maintenance_location';
      const lang = getSession(userId)?.lang || LANG;
      return ctx.reply(t('maintenanceLocation', lang));
    }

    case 'maintenance_location': {
      state.data.location = text;
      state.step = 'maintenance_priority';
      const lang = getSession(userId)?.lang || LANG;
      const kb = new InlineKeyboard()
        .text('🔴 Emergency', 'priority_emergency')
        .text('🟠 High', 'priority_high').row()
        .text('🟡 Medium', 'priority_medium')
        .text('🟢 Low', 'priority_low');
      return ctx.reply(t('maintenancePriority', lang), { reply_markup: kb });
    }

    // ── Contact admin ───────────────────────────────────────────────────
    case 'contact_message': {
      const session = getSession(userId);
      const lang = session?.lang || LANG;

      if (ADMIN_ID) {
        const adminMsg = `📨 *Message from Owner*\n\n` +
          `Unit: ${session.unit}\n` +
          `Owner: ${session.owner}\n` +
          `Message: ${text}`;
        try {
          await bot.api.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
          delete convState[chatId];
          await ctx.reply(t('contactSent', lang), { reply_markup: backKeyboard(lang) });
        } catch (e) {
          await ctx.reply('⚠️ Could not send message. Try again later.');
        }
      } else {
        delete convState[chatId];
        await ctx.reply(t('contactNoAdmin', lang), { reply_markup: backKeyboard(lang) });
      }
      return;
    }

    default:
      delete convState[chatId];
      return ctx.reply('Send /start to begin.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Action Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleBalance(ctx, session) {
  const lang = session.lang || LANG;
  try {
    // Refresh unit data
    const unit = await api(() => request('/pages/' + session.unitPageId, 'GET'));
    const balance = getNumber(unit, 'Current Balance') ?? 0;
    const owner = getText(unit, 'Owner Name');
    const lastPay = getDate(unit, 'Last Payment Date');
    const feeStatus = getSelect(unit, 'Fee Status');
    const share = getNumber(unit, 'Ownership Share (%)') || 0;
    const quarterlyFee = share * (BUILDING.annualBudget || 0) / 4;

    const status = balance >= 0 ? t('balancePositive', lang) : t('balanceNegative', lang);

    const text = fill(t('balance', lang), {
      unit: session.unit,
      owner,
      balance: fmtMoney(balance),
      status: feeStatus || status,
      lastPayment: lastPay ? fmtDate(lastPay) : '—',
      quarterlyFee: fmtMoney(quarterlyFee),
    });

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: backKeyboard(lang) });
  } catch (e) {
    await ctx.reply('⚠️ Error fetching balance. Try again.', { reply_markup: backKeyboard(lang) });
  }
}

async function handleStatement(ctx, session) {
  const lang = session.lang || LANG;
  try {
    if (!DB.ledger) return ctx.reply(t('noLedger', lang), { reply_markup: backKeyboard(lang) });

    const entries = await queryAll(DB.ledger, {
      property: 'Unit',
      relation: { contains: session.unitPageId },
    }, [{ property: 'Date', direction: 'descending' }]);

    if (!entries.length) {
      return ctx.reply(t('noLedger', lang), { reply_markup: backKeyboard(lang) });
    }

    const last10 = entries.slice(0, 10);
    let msg = fill(t('statement', lang), { unit: session.unit, count: String(last10.length) });

    for (const e of last10) {
      const date = getDate(e, 'Date');
      const type = getSelect(e, 'Type');
      const desc = getTitle(e);
      const debit = getNumber(e, 'Debit');
      const credit = getNumber(e, 'Credit');
      const bal = getNumber(e, 'Running Balance');

      let amounts = '';
      if (debit) amounts += `⬆️ Debit: ${fmtMoney(debit)} `;
      if (credit) amounts += `⬇️ Credit: ${fmtMoney(credit)} `;

      msg += `📌 ${fmtDate(date)} — *${type}*\n`;
      msg += `${desc}\n`;
      msg += `${amounts}\n\n`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: backKeyboard(lang) });
  } catch (e) {
    await ctx.reply('⚠️ Error fetching statement: ' + e.message, { reply_markup: backKeyboard(lang) });
  }
}

async function handleMaintenanceStart(ctx, session) {
  const lang = session.lang || LANG;
  convState[ctx.chat.id] = { step: 'maintenance_desc', data: {} };
  await ctx.reply(t('maintenance', lang));
}

async function handleMaintenancePriority(ctx, session, priority) {
  const lang = session.lang || LANG;
  const chatId = ctx.chat.id;
  const state = convState[chatId];

  if (!state?.data) return;

  const priorityMap = {
    'emergency': 'Emergency 🔴',
    'high': 'High 🟠',
    'medium': 'Medium 🟡',
    'low': 'Low 🟢',
  };

  const priorityName = priorityMap[priority] || 'Medium 🟡';
  const desc = state.data.description;
  const location = state.data.location;

  try {
    // Create maintenance request in Notion
    const properties = {
      'Request': { title: [{ text: { content: desc } }] },
      'Status':  { select: { name: 'New' } },
      'Priority': { select: { name: priorityName } },
      'Category': { select: { name: 'General' } },
      'Location': { rich_text: [{ text: { content: location } }] },
      'Reported By': { rich_text: [{ text: { content: session.owner } }] },
      'Reported Date': { date: { start: new Date().toISOString().slice(0, 10) } },
      'Unit': { relation: [{ id: session.unitPageId }] },
    };

    if (state.data.estimatedCost) {
      properties['Estimated Cost'] = { number: state.data.estimatedCost };
    }

    const page = await api(() => request('/pages', 'POST', JSON.stringify({
      parent: { database_id: DB.maintenance },
      properties,
    })));

    delete convState[chatId];

    const shortId = page.id.slice(0, 8);
    const text = fill(t('maintenanceSubmitted', lang), {
      id: shortId,
      desc,
      location,
      priority: priorityName,
    });

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: backKeyboard(lang) });

    // Notify admin
    if (ADMIN_ID) {
      const adminMsg = `🔧 *New Maintenance Request*\n\n` +
        `Unit: ${session.unit} (${session.owner})\n` +
        `Issue: ${desc}\n` +
        `Location: ${location}\n` +
        `Priority: ${priorityName}\n` +
        `Submitted via Owner Portal`;
      try {
        await bot.api.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
      } catch (e) { /* admin notification failed, not critical */ }
    }
  } catch (e) {
    delete convState[chatId];
    await ctx.reply('⚠️ Error submitting request: ' + e.message, { reply_markup: backKeyboard(lang) });
  }
}

async function handleMeetings(ctx, session) {
  const lang = session.lang || LANG;
  const labels = { es: { upcoming: '📅 *Próximas Reuniones*', past: '📋 *Reuniones Anteriores*', none: 'No hay reuniones programadas.' },
                   en: { upcoming: '📅 *Upcoming Meetings*', past: '📋 *Past Meetings*', none: 'No meetings scheduled.' },
                   fr: { upcoming: '📅 *Prochaines Réunions*', past: '📋 *Réunions Passées*', none: 'Aucune réunion prévue.' } };
  const L = labels[lang] || labels.es;
  try {
    if (!DB.meetings) return ctx.reply(t('noMeetings', lang), { reply_markup: backKeyboard(lang) });

    const meetings = await queryAll(DB.meetings, null, [{ property: 'Date', direction: 'descending' }]);
    if (!meetings.length) return ctx.reply(L.none, { reply_markup: backKeyboard(lang) });

    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = meetings.filter(m => { const d = getDate(m, 'Date'); return d && d >= todayStr; });
    const past = meetings.filter(m => { const d = getDate(m, 'Date'); return !d || d < todayStr; });

    let msg = '';

    if (upcoming.length) {
      msg += L.upcoming + '\n\n';
      for (const m of upcoming) {
        const title = getTitle(m);
        const date = getDate(m, 'Date');
        const type = getSelect(m, 'Type');
        msg += `🔔 *${fmtDate(date)}* — ${title}\nType: ${type}\n\n`;
      }
    } else {
      msg += L.upcoming + '\n_' + L.none + '_\n\n';
    }

    if (past.length) {
      msg += L.past + '\n\n';
      for (const m of past.slice(0, 5)) {
        const title = getTitle(m);
        const date = getDate(m, 'Date');
        const type = getSelect(m, 'Type');
        msg += `📌 *${fmtDate(date)}* — ${title}\nType: ${type}\n\n`;
      }
    }

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: backKeyboard(lang) });
  } catch (e) {
    await ctx.reply('⚠️ Error: ' + e.message, { reply_markup: backKeyboard(lang) });
  }
}

async function handleAnnouncements(ctx, session) {
  const lang = session.lang || LANG;
  try {
    if (!DB.communications) return ctx.reply(t('noAnnouncements', lang), { reply_markup: backKeyboard(lang) });

    // Get communications for this unit or general (no unit)
    const all = await queryAll(DB.communications, null, [{ property: 'Date', direction: 'descending' }]);

    // Filter: sent communications that are either for this unit or for all (no unit relation)
    const relevant = all.filter(c => {
      const unitRels = getRelationIds(c, 'Unit');
      const direction = getSelect(c, 'Direction');
      return direction === 'Sent' && (unitRels.length === 0 || unitRels.includes(session.unitPageId));
    });

    if (!relevant.length) {
      return ctx.reply(t('noAnnouncements', lang), { reply_markup: backKeyboard(lang) });
    }

    let msg = t('announcements', lang);
    for (const c of relevant.slice(0, 8)) {
      const title = getTitle(c);
      const date = getDate(c, 'Date');
      const type = getSelect(c, 'Type');
      const content = getText(c, 'Content');
      msg += `📌 *${fmtDate(date)}* — ${type}\n`;
      msg += `${title}\n`;
      if (content) msg += `_${content.slice(0, 150)}${content.length > 150 ? '...' : ''}_\n`;
      msg += '\n';
    }

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: backKeyboard(lang) });
  } catch (e) {
    await ctx.reply('⚠️ Error: ' + e.message, { reply_markup: backKeyboard(lang) });
  }
}

async function handleContactStart(ctx, session) {
  const lang = session.lang || LANG;
  convState[ctx.chat.id] = { step: 'contact_message' };
  await ctx.reply(t('contact', lang));
}

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

bot.catch((err) => {
  console.error('Bot error:', err.message);
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

console.log('🏢 Owner Portal Bot starting...');
console.log(`Building: ${BUILDING.name || '?'}`);
console.log(`Language: ${LANG}`);
console.log(`Units with PINs: ${Object.keys(PINS).length || 'none (demo mode — no PIN required)'}`);
console.log(`Admin chat ID: ${ADMIN_ID || 'not set'}`);
console.log('');

bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot online: @${botInfo.username}`);
    console.log(`Send /start to the bot to begin.`);
  },
});
