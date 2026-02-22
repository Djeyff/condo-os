// ═══════════════════════════════════════════════════════════════
// Condo Manager OS — Tier Gate
// Controls which features are available based on license tier
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const LICENSE_PATH = path.join(__dirname, '..', '.license');
const TIERS = { free: 0, pro: 1, enterprise: 2 };

const FREE_COMMANDS = ['dashboard', 'dash', 'help', '--help'];
const PRO_COMMANDS = [
  ...FREE_COMMANDS,
  'fee-call', 'feecall', 'fee_call',
  'payment', 'pay',
  'statement', 'stmt',
  'report',
  'delinquency', 'delinquent', 'delq',
  'close-year', 'closeyear', 'close_year',
  'expense', 'exp',
  'assessment', 'assess',
  'late-fees', 'latefees', 'late_fees', 'penalties',
  'reminder', 'remind', 'notice',
];
const ENTERPRISE_COMMANDS = [
  ...PRO_COMMANDS,
  'reserve-projection', 'reserve', 'reserves', 'projection',
  'agm-prep', 'agm', 'assembly',
  'multi-building', 'buildings',
  'owner-portal',
  'white-label',
  'payment-plan', 'payplan', 'plan', 'installments',
  'vote', 'meeting-report', 'meetingreport',
  'export', 'export-statement',
];

function getTier() {
  try {
    const license = fs.readFileSync(LICENSE_PATH, 'utf8').trim();
    // Simple key validation: pro-XXXX or enterprise-XXXX
    if (license.startsWith('enterprise-')) return 'enterprise';
    if (license.startsWith('pro-')) return 'pro';
    return 'free';
  } catch(_) {
    return 'free';
  }
}

function isCommandAllowed(command, tier) {
  tier = tier || getTier();
  const level = TIERS[tier] || 0;
  if (level >= 2) return true; // Enterprise: everything
  if (level >= 1) return PRO_COMMANDS.includes(command);
  return FREE_COMMANDS.includes(command);
}

function getUpgradeMessage(command) {
  const tier = getTier();
  if (tier === 'free') {
    return `
╔══════════════════════════════════════════════════════════════╗
║  🔒 "${command}" requires Condo Manager OS Pro              ║
║                                                              ║
║  Upgrade to unlock all 13 commands:                          ║
║  • Fee calls, payments, statements                           ║
║  • Financial reports & delinquency tracking                  ║
║  • Year-end closing & Excel import                           ║
║  • Late fees & payment reminders                             ║
║                                                              ║
║  🛒 Get Pro ($149): https://casedamare.gumroad.com/condo-os ║
║                                                              ║
║  Already purchased? Place your license key in .license       ║
╚══════════════════════════════════════════════════════════════╝`;
  }
  if (tier === 'pro') {
    return `
╔══════════════════════════════════════════════════════════════╗
║  🔒 "${command}" requires Condo Manager OS Enterprise       ║
║                                                              ║
║  Enterprise includes:                                        ║
║  • Multi-building management                                 ║
║  • Reserve fund projections                                  ║
║  • AGM preparation automation                                ║
║  • Owner self-service portal                                 ║
║  • White-label reports                                       ║
║  • Priority support + lifetime updates                       ║
║                                                              ║
║  🛒 Upgrade ($249): https://casedamare.gumroad.com/condo-os ║
╚══════════════════════════════════════════════════════════════╝`;
  }
  return '';
}

function getDashboardFooter() {
  const tier = getTier();
  if (tier === 'free') {
    return '\n  💡 Free tier — 1 of 13 commands available. Upgrade: https://casedamare.gumroad.com/condo-os\n';
  }
  if (tier === 'pro') {
    return '\n  ⚡ Pro tier — 11 of 13 commands. Enterprise unlocks reserves, AGM & more.\n';
  }
  return '\n  💎 Enterprise tier — All features unlocked.\n';
}

module.exports = { getTier, isCommandAllowed, getUpgradeMessage, getDashboardFooter, TIERS };
