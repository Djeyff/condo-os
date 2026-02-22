#!/usr/bin/env node
// =============================================================================
// Condo Manager OS — Social Media Content Generator & Auto-Poster
// =============================================================================
// Generates rotating content for X/Twitter, LinkedIn, Reddit, and Facebook.
// Designed to run as a cron job via OpenClaw.
//
// Usage:
//   node social-poster.js generate [--platform=x|linkedin|reddit|all]
//   node social-poster.js queue                    # Show pending posts
//   node social-poster.js post --platform=x        # Post next in queue
//   node social-poster.js stats                    # Engagement tracking
//   node social-poster.js seed                     # Generate initial content bank
//
// X/Twitter posting requires API keys in .env:
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
//
// LinkedIn/Reddit/Facebook: generates content for manual posting or
// future API integration.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const QUEUE_PATH = path.join(__dirname, '..', '.social-queue.json');
const STATS_PATH = path.join(__dirname, '..', '.social-stats.json');
const LANDING_URL = 'https://casedamare.github.io/condo-os';
const GITHUB_URL = 'https://github.com/casedamare/condo-os';
const GUMROAD_URL = 'https://casedamare.gumroad.com/condo-os';

// ─── Content Templates ──────────────────────────────────────────────────────

const CONTENT_BANK = {

  // ── Pain Point Posts (problem → solution) ──────────────────────────────

  painPoints: [
    {
      x: `Managing a condo with Excel spreadsheets? 😤\n\nI was too. Tracking 7 units, 140+ ledger entries, quarterly fees, delinquencies...\n\nSo I built an OS that does it all from Notion + AI.\n\n11 databases. 17 commands. One setup.\n\n${LANDING_URL}`,
      linkedin: `After years of managing a 7-unit condo with spreadsheets, I built something better.\n\nCondo Manager OS turns Notion into a full property management system:\n\n✅ 11 interconnected databases (auto-created)\n✅ 17 CLI commands for daily operations\n✅ Owner self-service portal (Telegram bot)\n✅ Automated payment reminders\n✅ Live dashboards with KPIs\n\nBuilt by a property manager, for property managers.\n\nFree & open source: ${GITHUB_URL}`,
      reddit_title: 'I built an open-source condo management OS with Notion + AI — 11 databases, 17 commands, owner portal',
      reddit_body: `After years of Excel hell managing a small condo (7 units), I built Condo Manager OS.\n\nIt turns Notion into a complete property management system with one setup command. 11 databases auto-created with relations, formulas, and rollups.\n\nFeatures:\n- Fee calls, payment tracking, statements\n- Delinquency tracking with aging\n- Owner portal (Telegram bot — owners check their own balance)\n- Auto late-fee calculation\n- Voting system with weighted quorum\n- 5 live dashboards\n- Excel import for migration\n- Trilingual (ES/EN/FR)\n\nFree on GitHub: ${GITHUB_URL}\n\nBeen using it in production for my own building. Would love feedback from other condo/HOA managers.`,
    },
    {
      x: `Your HOA treasurer is using a $4,800/year SaaS to manage 10 units? 🤯\n\nCondo Manager OS: $149 one-time. Or free (open source).\n\n• 11 Notion databases\n• Owner portal bot\n• Auto payment reminders\n• Weighted voting system\n\nBuilt by a real condo manager.\n\n${LANDING_URL}`,
      linkedin: `The average HOA management software costs $744-4,800/year.\n\nFor a 7-unit condo, that's insane.\n\nI built Condo Manager OS — a Notion-based system that does 90% of what Buildium does, for $149 one-time (or free on GitHub).\n\nThe secret? Notion as the database + AI for automation.\n\nNo monthly fees. No vendor lock-in. Your data stays yours.\n\n${GITHUB_URL}`,
    },
    {
      x: `Every condo board meeting:\n\n"Who owes what?"\n"Did we pay the plumber?"\n"What's our cash position?"\n\n*frantically opens 4 spreadsheets*\n\nOr... just type: condo-cli dashboard\n\n${LANDING_URL}`,
    },
    {
      x: `Condo owner knocking on your door at 9pm: "What's my balance?"\n\nWith Condo Manager OS, they just open Telegram:\n\n💰 Balance: -3,200 DOP\n📊 Last 10 transactions\n🔧 Submit maintenance request\n📅 Next meeting: March 15\n\nSelf-service portal. Trilingual. Zero effort.\n\n${LANDING_URL}`,
    },
  ],

  // ── Feature Spotlights ─────────────────────────────────────────────────

  features: [
    {
      x: `🗳️ Condo voting shouldn't need a lawyer.\n\nCondo Manager OS auto-calculates:\n• Weighted votes by ownership share\n• Quorum (% present)\n• Pass/fail based on bylaws\n\nOne command:\ncondo-cli vote "Roof Repair" --meeting="AGM 2026"\n\n${LANDING_URL}`,
    },
    {
      x: `"Send me my account statement"\n\n$ condo-cli export A-3 --lang=fr\n\n→ Professional statement in French\n→ Every transaction, running balance\n→ Ready to print or email\n\nTrilingual 🇪🇸🇬🇧🇫🇷 out of the box.\n\n${LANDING_URL}`,
    },
    {
      x: `Migrating from Excel to proper condo management?\n\n$ node import-excel.js your-data.xlsx\n\n→ Auto-detects sheets (units, ledger, expenses, budget)\n→ Creates all relations\n→ 5 minutes, not 5 weeks\n\n${LANDING_URL}`,
    },
    {
      x: `5 live dashboards, auto-generated from your data:\n\n📈 KPI Dashboard — financial health score\n📊 Financial — cash flow, budget vs actual\n🔴 Delinquency — per-unit aging, impact analysis\n🔧 Maintenance — status/priority board\n🏗️ Works — project progress tracking\n\nAll inside Notion.\n\n${LANDING_URL}`,
    },
    {
      x: `Payment plans for delinquent owners:\n\n$ condo-cli payment-plan A-1 187000 --installments=12\n\n→ Monthly schedule generated\n→ Auto-creates ledger entries\n→ Track compliance automatically\n\nBecause legal action should be the last resort.\n\n${LANDING_URL}`,
    },
    {
      x: `7 automation workflows running 24/7:\n\n✅ Payment received → notify admin + owner\n🔧 Maintenance status change → notify owner\n⚠️ 30+ days overdue → alert admin\n📅 Meeting in 48h → remind everyone\n💰 Budget line at 90% → warning\n🏦 Cash below threshold → critical alert\n\nAll via Telegram. No code needed.\n\n${LANDING_URL}`,
    },
  ],

  // ── Social Proof / Building in Public ──────────────────────────────────

  buildInPublic: [
    {
      x: `Built Condo Manager OS in a week.\n\n11 Notion databases\n17 CLI commands\nOwner portal bot\n7 automation workflows\n5 live dashboards\n2,922 lines of CLI code\n\nPowered by OpenClaw AI + Notion API.\n\nThe future of property management is AI-native.\n\n${GITHUB_URL}`,
    },
    {
      x: `Day 1: "I need a better way to track condo finances"\nDay 7: Full OS with 11 databases, portal bot, auto-dashboards\n\nBuilding with AI doesn't just save time.\nIt makes you build things you'd never attempt.\n\nOpen source: ${GITHUB_URL}`,
    },
    {
      x: `Managing condos in the Caribbean?\n\nYour residents speak Spanish, English, AND French.\n\nCondo Manager OS is trilingual 🇪🇸🇬🇧🇫🇷:\n• CLI commands\n• Owner portal\n• Account statements\n• Payment reminders\n\nBuilt for the real world.\n\n${LANDING_URL}`,
    },
  ],

  // ── Technical / Developer Appeal ───────────────────────────────────────

  technical: [
    {
      x: `setup.js: 1,020 lines\n→ Creates 11 Notion databases\n→ Wires 19 dual relations\n→ Generates 16 formulas (including weighted vote calculations)\n→ Sets rollups, colors, icons\n→ One command. Zero manual setup.\n\nThis is what AI-native tooling looks like.\n\n${GITHUB_URL}`,
    },
    {
      x: `TIL: Notion formulas can calculate weighted voting quorum.\n\nEach unit has an ownership % hardcoded in the formula.\nVotes are select fields (For/Against/Abstain/Absent).\nFormulas auto-calculate totals + quorum + pass/fail.\n\nNo code needed at runtime. Pure Notion.\n\n${GITHUB_URL}`,
    },
  ],
};

// ─── Post Queue Management ───────────────────────────────────────────────────

function loadQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')); }
  catch { return { posts: [], lastGenerated: null }; }
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

function loadStats() {
  try { return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8')); }
  catch { return { posted: [], totalPosts: 0, byPlatform: {} }; }
}

function saveStats(stats) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdSeed() {
  const queue = loadQueue();
  const platforms = ['x', 'linkedin', 'reddit'];
  let count = 0;

  for (const [category, items] of Object.entries(CONTENT_BANK)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      for (const platform of platforms) {
        let content;
        if (platform === 'x' && item.x) content = item.x;
        else if (platform === 'linkedin' && item.linkedin) content = item.linkedin;
        else if (platform === 'reddit' && item.reddit_title) {
          content = `TITLE: ${item.reddit_title}\n\n${item.reddit_body}`;
        }
        else continue;

        queue.posts.push({
          id: `${category}-${i}-${platform}`,
          platform,
          category,
          content,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        count++;
      }
    }
  }

  queue.lastGenerated = new Date().toISOString();
  saveQueue(queue);
  console.log(`✅ Seeded ${count} posts across ${platforms.length} platforms`);
  console.log(`   Total in queue: ${queue.posts.filter(p => p.status === 'pending').length} pending`);
}

function cmdQueue(opts) {
  const queue = loadQueue();
  const platform = opts.platform || 'all';
  const pending = queue.posts.filter(p =>
    p.status === 'pending' && (platform === 'all' || p.platform === platform)
  );

  console.log(`\n📋 SOCIAL MEDIA QUEUE — ${pending.length} pending\n`);

  for (const p of pending.slice(0, 10)) {
    console.log(`─────────────────────────────────────────`);
    console.log(`[${p.platform.toUpperCase()}] ${p.category} (${p.id})`);
    console.log(p.content.slice(0, 200) + (p.content.length > 200 ? '...' : ''));
    console.log();
  }

  if (pending.length > 10) console.log(`... and ${pending.length - 10} more`);
}

function cmdGenerate(opts) {
  const platform = opts.platform || 'x';

  // Pick a random post from content bank
  const categories = Object.keys(CONTENT_BANK);
  const cat = categories[Math.floor(Math.random() * categories.length)];
  const items = CONTENT_BANK[cat];
  const item = items[Math.floor(Math.random() * items.length)];

  let content;
  if (platform === 'x' && item.x) content = item.x;
  else if (platform === 'linkedin' && item.linkedin) content = item.linkedin;
  else if (platform === 'reddit' && item.reddit_title) {
    content = `TITLE: ${item.reddit_title}\n\n${item.reddit_body}`;
  }
  else content = item.x || item.linkedin || 'No content for this platform';

  console.log(`\n🎯 Generated for ${platform.toUpperCase()} (${cat}):\n`);
  console.log(content);
  console.log(`\nCharacters: ${content.length}`);
  if (platform === 'x' && content.length > 280) {
    console.log(`⚠️  Over 280 char limit for X (${content.length}). Thread or trim needed.`);
  }

  return content;
}

function cmdPost(opts) {
  const platform = opts.platform;
  if (!platform) {
    console.log('Usage: social-poster.js post --platform=x|linkedin|reddit');
    return;
  }

  const queue = loadQueue();
  const next = queue.posts.find(p => p.status === 'pending' && p.platform === platform);

  if (!next) {
    console.log(`No pending posts for ${platform}. Run 'seed' or 'generate' first.`);
    return;
  }

  console.log(`\n📤 READY TO POST on ${platform.toUpperCase()}:\n`);
  console.log(next.content);
  console.log(`\n─────────────────────────────────────────`);
  console.log(`Post ID: ${next.id}`);
  console.log(`\nTo mark as posted: edit .social-queue.json and set status to "posted"`);
  console.log(`Or implement API posting below.\n`);

  // TODO: Implement actual X API posting
  // For now, this is a manual workflow:
  // 1. Cron generates → 2. Review in Telegram → 3. Approve → 4. Post via API

  // Mark as posted (for queue rotation)
  next.status = 'posted';
  next.postedAt = new Date().toISOString();
  saveQueue(queue);

  const stats = loadStats();
  stats.totalPosts++;
  stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
  stats.posted.push({ id: next.id, platform, postedAt: next.postedAt });
  saveStats(stats);
}

function cmdStats() {
  const stats = loadStats();
  const queue = loadQueue();
  const pending = queue.posts.filter(p => p.status === 'pending').length;

  console.log(`\n📊 SOCIAL MEDIA STATS\n`);
  console.log(`Total posted: ${stats.totalPosts}`);
  console.log(`Pending in queue: ${pending}`);
  console.log(`\nBy platform:`);
  for (const [p, c] of Object.entries(stats.byPlatform || {})) {
    console.log(`  ${p}: ${c} posts`);
  }

  if (stats.posted?.length) {
    console.log(`\nRecent posts:`);
    for (const p of stats.posted.slice(-5)) {
      console.log(`  [${p.platform}] ${p.id} — ${p.postedAt}`);
    }
  }
}

// ─── Cron-friendly: Generate + Output for Telegram Review ────────────────────

function cmdCronGenerate() {
  // For use in OpenClaw cron — generates a post and outputs it for review
  const platforms = ['x', 'linkedin'];
  const output = [];

  for (const platform of platforms) {
    const categories = Object.keys(CONTENT_BANK);
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const items = CONTENT_BANK[cat];
    const item = items[Math.floor(Math.random() * items.length)];

    let content;
    if (platform === 'x') content = item.x;
    else if (platform === 'linkedin') content = item.linkedin;
    if (!content) continue;

    output.push({ platform, category: cat, content });
  }

  // Output as structured text for the cron agent to send via Telegram
  let msg = '📱 **Social Media Content Ready**\n\n';
  for (const o of output) {
    msg += `**${o.platform.toUpperCase()}** (${o.category}):\n`;
    msg += '```\n' + o.content + '\n```\n\n';
  }
  msg += 'Reply "post" to approve, or "skip" to generate new content.';
  console.log(msg);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';
  const opts = {};
  for (const a of args) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) opts[a.slice(2, eq)] = a.slice(eq + 1);
      else opts[a.slice(2)] = true;
    }
  }

  switch (cmd) {
    case 'seed':     return cmdSeed();
    case 'queue':    return cmdQueue(opts);
    case 'generate': return cmdGenerate(opts);
    case 'post':     return cmdPost(opts);
    case 'stats':    return cmdStats();
    case 'cron':     return cmdCronGenerate();
    default:
      console.log(`
📱 Condo Manager OS — Social Media Poster

Commands:
  seed              Populate queue from content bank
  queue             Show pending posts (--platform=x|linkedin|reddit|all)
  generate          Generate a random post (--platform=x|linkedin|reddit)
  post              Mark next post as posted (--platform=x)
  stats             Show posting stats
  cron              Generate content for Telegram review (cron-friendly)

Setup:
  1. Run 'seed' to populate the queue
  2. Set up a daily cron in OpenClaw to run 'cron'
  3. Review generated content in Telegram
  4. Approve/post manually or via API

Platforms: x (Twitter/X), linkedin, reddit
Landing: ${LANDING_URL}
GitHub:  ${GITHUB_URL}
`);
  }
}

main();
