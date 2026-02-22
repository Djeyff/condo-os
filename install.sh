#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Condo Manager OS — One-Command Installer
# ═══════════════════════════════════════════════════════════════
#
# Usage:
#   ./install.sh                          # Interactive install
#   ./install.sh --notion-key ntn_xxx     # Skip API key prompt
#   ./install.sh --skip-databases         # Install skill only, create DBs later
#   ./install.sh --openclaw-dir ~/clawd   # Custom OpenClaw directory
#
# What it does:
#   1. Detects OpenClaw installation
#   2. Installs the skill
#   3. Creates Notion databases (optional)
#   4. Sets up MEMORY.md template
#   5. Sets up SOUL.md template
#   6. Configures daily backup cron (optional)
#   7. Verifies everything works

set -euo pipefail

# ─── Colors ────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${BLUE}[INSTALL]${NC} $1"; }
ok()      { echo -e "${GREEN}  ✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
err()     { echo -e "${RED}  ❌ $1${NC}" >&2; }
header()  { echo -e "\n${BOLD}${BLUE}═══ $1 ═══${NC}\n"; }
ask()     { echo -en "${YELLOW}  → $1 ${NC}"; }

# ─── Parse args ────────────────────────────────────────
NOTION_KEY=""
SKIP_DBS=false
OPENCLAW_DIR=""
PARENT_PAGE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --notion-key)     NOTION_KEY="$2"; shift 2 ;;
    --skip-databases) SKIP_DBS=true; shift ;;
    --openclaw-dir)   OPENCLAW_DIR="$2"; shift 2 ;;
    --parent-page)    PARENT_PAGE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--notion-key KEY] [--skip-databases] [--openclaw-dir DIR] [--parent-page ID]"
      exit 0 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║        🏢 Condo Manager OS — Installer               ║${NC}"
echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Step 1: Detect OpenClaw ───────────────────────────
header "Step 1: Detecting OpenClaw"

if [ -n "$OPENCLAW_DIR" ]; then
  OC_DIR="$OPENCLAW_DIR"
elif [ -d "$HOME/.openclaw" ]; then
  OC_DIR="$HOME/.openclaw"
elif [ -d "$HOME/clawd" ]; then
  OC_DIR="$HOME/clawd"
elif [ -d "/app" ] && [ -f "/app/package.json" ]; then
  # Docker/Zeabur container
  OC_DIR="/app"
else
  warn "OpenClaw directory not auto-detected."
  ask "Enter your OpenClaw directory path: "
  read -r OC_DIR
fi

if [ ! -d "$OC_DIR" ]; then
  err "Directory not found: $OC_DIR"
  exit 1
fi

ok "OpenClaw found at: $OC_DIR"

# Determine skills directory
SKILLS_DIR=""
for candidate in "$OC_DIR/skills" "$OC_DIR/.openclaw/skills" "$HOME/.openclaw/skills"; do
  if [ -d "$candidate" ]; then
    SKILLS_DIR="$candidate"
    break
  fi
done

if [ -z "$SKILLS_DIR" ]; then
  SKILLS_DIR="$OC_DIR/skills"
  mkdir -p "$SKILLS_DIR"
  warn "Created skills directory: $SKILLS_DIR"
fi

ok "Skills directory: $SKILLS_DIR"

# ─── Step 2: Check dependencies ───────────────────────
header "Step 2: Checking dependencies"

# curl
if command -v curl &>/dev/null; then
  ok "curl installed"
else
  err "curl not found. Install it first."
  exit 1
fi

# jq (optional but recommended)
if command -v jq &>/dev/null; then
  ok "jq installed"
else
  warn "jq not found — backup CSV export will be limited"
  warn "Install: apt-get install jq / brew install jq"
fi

# rclone (optional for cloud backup)
if command -v rclone &>/dev/null; then
  ok "rclone installed (cloud backup available)"
else
  log "rclone not installed — cloud backup not available (optional)"
  log "Install later: curl https://rclone.org/install.sh | sudo bash"
fi

# ─── Step 3: Notion API Key ───────────────────────────
header "Step 3: Notion API Key"

if [ -z "$NOTION_KEY" ]; then
  # Check environment
  if [ -n "${NOTION_API_KEY:-}" ]; then
    NOTION_KEY="$NOTION_API_KEY"
    ok "Found NOTION_API_KEY in environment"
  else
    echo "  You need a Notion integration token."
    echo "  Create one at: https://www.notion.so/my-integrations"
    echo ""
    ask "Enter your Notion API key (ntn_...): "
    read -r NOTION_KEY
  fi
fi

if [[ ! "$NOTION_KEY" =~ ^(ntn_|secret_) ]]; then
  warn "Key doesn't start with ntn_ or secret_ — double-check it"
fi

# Verify the key works
log "Verifying Notion API key..."
test_response=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://api.notion.com/v1/users/me" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2022-06-28" 2>/dev/null)

if [ "$test_response" = "200" ]; then
  ok "Notion API key verified ✅"
else
  err "Notion API key invalid (HTTP $test_response)"
  echo "  Get a new one at: https://www.notion.so/my-integrations"
  exit 1
fi

# ─── Step 4: Install Skill ────────────────────────────
header "Step 4: Installing Skill"

SKILL_DEST="$SKILLS_DIR/condo-manager-os"

if [ -d "$SKILL_DEST" ]; then
  warn "Skill already exists at $SKILL_DEST"
  ask "Overwrite? (y/N): "
  read -r overwrite
  if [[ "$overwrite" =~ ^[Yy] ]]; then
    rm -rf "$SKILL_DEST"
  else
    log "Keeping existing skill"
  fi
fi

if [ ! -d "$SKILL_DEST" ]; then
  cp -r "$SCRIPT_DIR" "$SKILL_DEST"
  # Remove install script from the installed copy
  rm -f "$SKILL_DEST/install.sh"
  ok "Skill installed to $SKILL_DEST"
fi

# ─── Step 5: Create Notion Databases ──────────────────
header "Step 5: Notion Databases"

if [ "$SKIP_DBS" = true ]; then
  log "Skipping database creation (--skip-databases)"
  log "Run later: $SKILL_DEST/scripts/setup-databases.sh $NOTION_KEY <PAGE_ID>"
else
  if [ -z "$PARENT_PAGE" ]; then
    echo "  Create a page in Notion for your building management."
    echo "  Share it with your integration (... → Connections → Add)"
    echo "  Copy the page ID from the URL."
    echo ""
    ask "Enter the Notion parent page ID (or 'skip'): "
    read -r PARENT_PAGE
  fi
  
  if [ "$PARENT_PAGE" = "skip" ] || [ -z "$PARENT_PAGE" ]; then
    log "Skipping database creation — run setup-databases.sh later"
  else
    log "Creating 9 Notion databases..."
    bash "$SKILL_DEST/scripts/setup-databases.sh" "$NOTION_KEY" "$PARENT_PAGE"
  fi
fi

# ─── Step 6: Setup MEMORY.md ─────────────────────────
header "Step 6: Agent Memory"

MEMORY_DEST="$OC_DIR/MEMORY.md"
if [ -f "$MEMORY_DEST" ]; then
  log "MEMORY.md already exists."
  ask "Append Condo Manager section? (Y/n): "
  read -r append_mem
  if [[ ! "$append_mem" =~ ^[Nn] ]]; then
    echo "" >> "$MEMORY_DEST"
    echo "---" >> "$MEMORY_DEST"
    echo "" >> "$MEMORY_DEST"
    cat "$SCRIPT_DIR/templates/MEMORY.md" >> "$MEMORY_DEST"
    ok "Appended to $MEMORY_DEST"
  fi
else
  cp "$SCRIPT_DIR/templates/MEMORY.md" "$MEMORY_DEST"
  ok "Created $MEMORY_DEST"
fi
log "⚠️  Remember to fill in your building details in MEMORY.md!"

# ─── Step 7: Setup SOUL.md ───────────────────────────
header "Step 7: Agent Personality"

SOUL_DEST="$OC_DIR/SOUL.md"
if [ -f "$SOUL_DEST" ]; then
  log "SOUL.md already exists."
  ask "Append Condo Manager personality? (Y/n): "
  read -r append_soul
  if [[ ! "$append_soul" =~ ^[Nn] ]]; then
    echo "" >> "$SOUL_DEST"
    echo "---" >> "$SOUL_DEST"
    echo "" >> "$SOUL_DEST"
    cat "$SCRIPT_DIR/templates/SOUL.md" >> "$SOUL_DEST"
    ok "Appended to $SOUL_DEST"
  fi
else
  cp "$SCRIPT_DIR/templates/SOUL.md" "$SOUL_DEST"
  ok "Created $SOUL_DEST"
fi

# ─── Step 8: Setup Backup Cron ────────────────────────
header "Step 8: Daily Backup (Optional)"

chmod +x "$SKILL_DEST/scripts/backup-notion.sh"
echo "  The backup script exports all 9 databases to JSON+CSV daily."
echo "  With rclone, it can upload to kDrive, S3, Google Drive, etc."
echo ""
ask "Set up daily backup cron at 2 AM? (y/N): "
read -r setup_cron

if [[ "$setup_cron" =~ ^[Yy] ]]; then
  BACKUP_CMD="NOTION_API_KEY=$NOTION_KEY $SKILL_DEST/scripts/backup-notion.sh"
  
  if command -v rclone &>/dev/null; then
    ask "rclone remote name for cloud upload (or 'local' for local only): "
    read -r remote_name
    if [ "$remote_name" != "local" ] && [ -n "$remote_name" ]; then
      BACKUP_CMD="$BACKUP_CMD --cloud $remote_name"
    fi
  fi
  
  # Add to crontab
  (crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_CMD >> /var/log/condo-backup.log 2>&1") | crontab -
  ok "Daily backup cron installed (2 AM)"
  log "Backups saved to: ~/.condo-backups/"
  log "Logs: /var/log/condo-backup.log"
else
  log "Skipped. Run manually: $SKILL_DEST/scripts/backup-notion.sh"
fi

# ─── Done ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        🎉 Condo Manager OS — Installed!              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo ""
echo "  1. Fill in your building info:"
echo "     ${BLUE}nano $MEMORY_DEST${NC}"
echo ""
echo "  2. Test the skill — message your agent:"
echo "     ${BLUE}\"Initialize Condo Manager OS\"${NC}"
echo ""
echo "  3. Register your units:"
echo "     ${BLUE}\"Add unit A-1, owner John Smith, 15.5% share\"${NC}"
echo ""
echo "  4. Full guide: $SKILL_DEST/QUICKSTART.md"
echo ""
