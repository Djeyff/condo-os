#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Condo Manager OS — Daily Notion Backup
# Exports all 9 databases to JSON + CSV and uploads to cloud
# ═══════════════════════════════════════════════════════════════
#
# Supports: kDrive, S3, Google Drive, Dropbox, OneDrive, SFTP
# via rclone (https://rclone.org)
#
# Usage:
#   ./backup-notion.sh                    # Local backup only
#   ./backup-notion.sh --cloud myremote   # Local + upload to rclone remote
#
# Cron (daily at 2 AM):
#   0 2 * * * /path/to/backup-notion.sh --cloud myremote >> /var/log/condo-backup.log 2>&1
#
# Docker/Zeabur cron (add to container):
#   Add to your Dockerfile or entrypoint script
#
# First-time rclone setup:
#   rclone config   (interactive — choose your cloud provider)
#
# Environment:
#   NOTION_API_KEY    (required)
#   BACKUP_DIR        (optional, default: ~/.condo-backups)
#   BACKUP_RETAIN     (optional, days to keep, default: 30)

set -euo pipefail

# ─── Configuration ──────────────────────────────────────
NOTION_API_KEY="${NOTION_API_KEY:?Set NOTION_API_KEY}"
NOTION_VERSION="2022-06-28"
BACKUP_DIR="${BACKUP_DIR:-$HOME/.condo-backups}"
BACKUP_RETAIN="${BACKUP_RETAIN:-30}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
TODAY_DIR="$BACKUP_DIR/$TIMESTAMP"

# Parse args
CLOUD_REMOTE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --cloud) CLOUD_REMOTE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
err()  { echo -e "${RED}  ❌ $1${NC}" >&2; }

# ─── Read database IDs from MEMORY.md ───────────────────
MEMORY_FILE=""
for path in "$HOME/.openclaw/MEMORY.md" "$HOME/clawd/MEMORY.md" "./MEMORY.md"; do
  if [ -f "$path" ]; then
    MEMORY_FILE="$path"
    break
  fi
done

if [ -z "$MEMORY_FILE" ]; then
  err "MEMORY.md not found. Expected in ~/.openclaw/ or ~/clawd/"
  echo "Tip: Set database IDs manually in this script if MEMORY.md is elsewhere."
  exit 1
fi

log "Reading database IDs from $MEMORY_FILE"

# Extract Notion database IDs (32-char hex, with or without dashes)
declare -A DATABASES
while IFS= read -r line; do
  # Match lines like: "- **Units Registry**: abc123def456"
  if [[ "$line" =~ \*\*([^*]+)\*\*:\ *([a-f0-9-]{32,36}) ]]; then
    name="${BASH_REMATCH[1]}"
    id="${BASH_REMATCH[2]}"
    DATABASES["$name"]="$id"
  fi
done < "$MEMORY_FILE"

if [ ${#DATABASES[@]} -eq 0 ]; then
  err "No database IDs found in MEMORY.md"
  echo "Expected format: - **Database Name**: <notion-id>"
  exit 1
fi

log "Found ${#DATABASES[@]} databases to back up"

# ─── Create backup directory ────────────────────────────
mkdir -p "$TODAY_DIR"
log "Backup directory: $TODAY_DIR"

# ─── Export each database ───────────────────────────────
export_database() {
  local name="$1"
  local db_id="$2"
  local safe_name=$(echo "$name" | tr ' ' '_' | tr -cd 'A-Za-z0-9_-')
  local json_file="$TODAY_DIR/${safe_name}.json"
  local csv_file="$TODAY_DIR/${safe_name}.csv"
  
  log "Exporting: $name ($db_id)"
  
  # Query all pages in the database
  local all_results="[]"
  local has_more=true
  local start_cursor=""
  local page_count=0
  
  while [ "$has_more" = "true" ]; do
    local payload='{"page_size": 100'
    if [ -n "$start_cursor" ]; then
      payload="$payload, \"start_cursor\": \"$start_cursor\""
    fi
    payload="$payload}"
    
    response=$(curl -s -X POST "https://api.notion.com/v1/databases/$db_id/query" \
      -H "Authorization: Bearer $NOTION_API_KEY" \
      -H "Notion-Version: $NOTION_VERSION" \
      -H "Content-Type: application/json" \
      -d "$payload" 2>/dev/null)
    
    # Check for errors
    if echo "$response" | grep -q '"object":"error"'; then
      warn "Error querying $name: $(echo "$response" | grep -o '"message":"[^"]*"')"
      return 1
    fi
    
    # Extract results
    if command -v jq &>/dev/null; then
      local results=$(echo "$response" | jq '.results')
      has_more=$(echo "$response" | jq -r '.has_more')
      start_cursor=$(echo "$response" | jq -r '.next_cursor // empty')
      local count=$(echo "$results" | jq 'length')
      page_count=$((page_count + count))
      
      # Merge results
      all_results=$(echo "$all_results $results" | jq -s 'add')
    else
      # Without jq, save raw response and break
      echo "$response" > "$json_file"
      ok "$name → $json_file (raw, install jq for full export)"
      return 0
    fi
    
    sleep 0.35  # Rate limit
  done
  
  # Save JSON
  echo "$all_results" | jq '.' > "$json_file"
  ok "$name → $json_file ($page_count records)"
  
  # Convert to CSV for spreadsheet access
  if command -v jq &>/dev/null && [ "$page_count" -gt 0 ]; then
    # Extract property names from first record
    local props=$(echo "$all_results" | jq -r '.[0].properties | keys[]' 2>/dev/null)
    
    if [ -n "$props" ]; then
      # CSV header
      echo "$props" | tr '\n' ',' | sed 's/,$/\n/' > "$csv_file"
      
      # CSV rows (extract plain text values)
      echo "$all_results" | jq -r '
        .[] | .properties | to_entries | map(
          .value |
          if .type == "title" then (.title // [] | map(.plain_text // "") | join(""))
          elif .type == "rich_text" then (.rich_text // [] | map(.plain_text // "") | join(""))
          elif .type == "number" then (.number // "" | tostring)
          elif .type == "select" then (.select.name // "")
          elif .type == "multi_select" then (.multi_select // [] | map(.name) | join("; "))
          elif .type == "date" then (.date.start // "")
          elif .type == "checkbox" then (if .checkbox then "Yes" else "No" end)
          elif .type == "email" then (.email // "")
          elif .type == "phone_number" then (.phone_number // "")
          elif .type == "url" then (.url // "")
          elif .type == "files" then (.files // [] | map(.name // .external.url // "") | join("; "))
          elif .type == "relation" then (.relation // [] | map(.id) | join("; "))
          elif .type == "formula" then (
            if .formula.type == "number" then (.formula.number // "" | tostring)
            elif .formula.type == "string" then (.formula.string // "")
            else ""
            end
          )
          else ""
          end
        ) | @csv
      ' >> "$csv_file" 2>/dev/null
      
      ok "$name → $csv_file"
    fi
  fi
}

# Export all databases
FAIL_COUNT=0
for name in "${!DATABASES[@]}"; do
  export_database "$name" "${DATABASES[$name]}" || FAIL_COUNT=$((FAIL_COUNT + 1))
done

# ─── Backup metadata ───────────────────────────────────
cat > "$TODAY_DIR/backup-info.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -Iseconds)",
  "databases_found": ${#DATABASES[@]},
  "databases_failed": $FAIL_COUNT,
  "backup_dir": "$TODAY_DIR",
  "notion_version": "$NOTION_VERSION",
  "hostname": "$(hostname)"
}
EOF

# ─── Compress ──────────────────────────────────────────
ARCHIVE="$BACKUP_DIR/condo-backup-$TIMESTAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$TIMESTAMP"
log "Compressed: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# ─── Upload to cloud ──────────────────────────────────
if [ -n "$CLOUD_REMOTE" ]; then
  if ! command -v rclone &>/dev/null; then
    warn "rclone not installed. Install: curl https://rclone.org/install.sh | sudo bash"
    warn "Then configure: rclone config"
  else
    REMOTE_PATH="$CLOUD_REMOTE:condo-backups/"
    log "Uploading to $REMOTE_PATH..."
    
    if rclone copy "$ARCHIVE" "$REMOTE_PATH" --progress 2>/dev/null; then
      ok "Uploaded to $REMOTE_PATH"
    else
      err "Upload failed. Check rclone config: rclone config show $CLOUD_REMOTE"
    fi
  fi
fi

# ─── Cleanup old backups ──────────────────────────────
if [ "$BACKUP_RETAIN" -gt 0 ]; then
  log "Cleaning backups older than $BACKUP_RETAIN days..."
  find "$BACKUP_DIR" -name "condo-backup-*.tar.gz" -mtime +"$BACKUP_RETAIN" -delete 2>/dev/null
  find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" -mtime +"$BACKUP_RETAIN" -exec rm -rf {} + 2>/dev/null
  ok "Old backups cleaned"
fi

# ─── Summary ──────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Backup complete: $TIMESTAMP${NC}"
echo -e "${GREEN}  Databases: ${#DATABASES[@]} found, $FAIL_COUNT failed${NC}"
echo -e "${GREEN}  Archive: $ARCHIVE${NC}"
if [ -n "$CLOUD_REMOTE" ]; then
  echo -e "${GREEN}  Cloud: $CLOUD_REMOTE:condo-backups/${NC}"
fi
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
