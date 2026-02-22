#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Condo Manager OS — Notion Database Setup Script
# Creates all 9 databases with correct schemas
# ═══════════════════════════════════════════════════════════════
#
# Usage: ./setup-databases.sh <NOTION_API_KEY> <PARENT_PAGE_ID>
#
# Prerequisites:
#   - curl + jq installed
#   - Notion integration created at https://www.notion.so/my-integrations
#   - Integration shared with the parent page in Notion
#
# What this creates:
#   1. 🏠 Units Registry
#   2. 💰 Owner Ledger
#   3. 📋 Budget
#   4. 💸 Expenses
#   5. 🔧 Maintenance Requests
#   6. 🏗️ Works & Projects
#   7. 🏦 Cash Position
#   8. 📨 Communications Log
#   9. 📅 Meetings

set -euo pipefail

NOTION_API_KEY="${1:?Usage: $0 <NOTION_API_KEY> <PARENT_PAGE_ID>}"
PARENT_PAGE_ID="${2:?Usage: $0 <NOTION_API_KEY> <PARENT_PAGE_ID>}"
NOTION_VERSION="2022-06-28"
BASE_URL="https://api.notion.com/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
err()  { echo -e "${RED}  ❌ $1${NC}" >&2; exit 1; }

# Store created database IDs
declare -A DB_IDS

create_database() {
  local payload="$1"
  local name="$2"
  
  log "Creating $name..."
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/databases" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: $NOTION_VERSION" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" != "200" ]; then
    echo "$body" | head -5
    err "Failed to create $name (HTTP $http_code)"
  fi
  
  # Extract ID — works with or without jq
  if command -v jq &>/dev/null; then
    db_id=$(echo "$body" | jq -r '.id')
  else
    db_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  fi
  
  ok "Created $name: $db_id"
  DB_IDS["$name"]="$db_id"
  
  # Rate limit: Notion allows 3 req/sec
  sleep 0.4
}

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🏢 Condo Manager OS — Database Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
log "Parent page: $PARENT_PAGE_ID"
echo ""

# ─── 1. Units Registry ─────────────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "🏠 Units Registry"}}],
  "properties": {
    "Unit": {"title": {}},
    "Owner Name": {"rich_text": {}},
    "Owner Email": {"email": {}},
    "Owner Phone": {"phone_number": {}},
    "Owner Address": {"rich_text": {}},
    "Tenant Name": {"rich_text": {}},
    "Tenant Email": {"email": {}},
    "Tenant Phone": {"phone_number": {}},
    "Ownership Share (%)": {"number": {"format": "percent"}},
    "Status": {"select": {"options": [
      {"name": "Owner-Occupied", "color": "blue"},
      {"name": "Rented", "color": "green"},
      {"name": "Vacant", "color": "gray"},
      {"name": "Under Renovation", "color": "orange"},
      {"name": "Foreclosure", "color": "red"}
    ]}},
    "Size": {"number": {"format": "number"}},
    "Bedrooms": {"number": {"format": "number"}},
    "Floor": {"number": {"format": "number"}},
    "Parking Space": {"rich_text": {}},
    "Current Balance": {"number": {"format": "dollar"}},
    "Fee Status": {"select": {"options": [
      {"name": "Current", "color": "green"},
      {"name": "Overdue 1-30", "color": "yellow"},
      {"name": "Overdue 31-60", "color": "orange"},
      {"name": "Overdue 61-90", "color": "red"},
      {"name": "Overdue 90+", "color": "pink"},
      {"name": "Payment Plan", "color": "purple"},
      {"name": "Legal", "color": "red"}
    ]}},
    "Lease Start": {"date": {}},
    "Lease End": {"date": {}},
    "Last Payment Date": {"date": {}},
    "Emergency Contact": {"rich_text": {}},
    "Notes": {"rich_text": {}}
  }
}' "Units Registry"

# ─── 2. Owner Ledger ───────────────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "💰 Owner Ledger"}}],
  "properties": {
    "Entry": {"title": {}},
    "Date": {"date": {}},
    "Type": {"select": {"options": [
      {"name": "Fee Call", "color": "blue"},
      {"name": "Payment Received", "color": "green"},
      {"name": "Work Assessment", "color": "orange"},
      {"name": "Adjustment", "color": "gray"},
      {"name": "Late Fee", "color": "red"},
      {"name": "Credit", "color": "green"},
      {"name": "Refund", "color": "yellow"},
      {"name": "Private Charge", "color": "pink"},
      {"name": "Year-End Closing Adjustment", "color": "purple"}
    ]}},
    "Debit": {"number": {"format": "dollar"}},
    "Credit": {"number": {"format": "dollar"}},
    "Balance After": {"number": {"format": "dollar"}},
    "Period": {"rich_text": {}},
    "Category": {"select": {"options": [
      {"name": "Common Charges", "color": "blue"},
      {"name": "Extraordinary Assessment", "color": "orange"},
      {"name": "Work Provision", "color": "yellow"},
      {"name": "Insurance", "color": "purple"},
      {"name": "Reserve Fund", "color": "green"},
      {"name": "Administrative", "color": "gray"},
      {"name": "Legal Fees", "color": "red"},
      {"name": "Private", "color": "pink"}
    ]}},
    "Payment Method": {"select": {"options": [
      {"name": "Cash", "color": "green"},
      {"name": "Bank Transfer", "color": "blue"},
      {"name": "Check", "color": "gray"},
      {"name": "Credit Card", "color": "purple"},
      {"name": "Offset/Credit", "color": "yellow"}
    ]}},
    "Reference": {"rich_text": {}},
    "Notes": {"rich_text": {}},
    "Verified": {"checkbox": {}},
    "Fiscal Year": {"number": {"format": "number"}}
  }
}' "Owner Ledger"

# ─── 3. Budget ─────────────────────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "📋 Budget"}}],
  "properties": {
    "Category": {"title": {}},
    "Annual Budget": {"number": {"format": "dollar"}},
    "Q1 Actual": {"number": {"format": "dollar"}},
    "Q2 Actual": {"number": {"format": "dollar"}},
    "Q3 Actual": {"number": {"format": "dollar"}},
    "Q4 Actual": {"number": {"format": "dollar"}},
    "Department": {"select": {"options": [
      {"name": "Utilities", "color": "yellow"},
      {"name": "Maintenance", "color": "blue"},
      {"name": "Security", "color": "red"},
      {"name": "Insurance", "color": "purple"},
      {"name": "Cleaning", "color": "green"},
      {"name": "Landscaping", "color": "green"},
      {"name": "Administrative", "color": "gray"},
      {"name": "Legal", "color": "pink"},
      {"name": "Reserve Fund", "color": "orange"},
      {"name": "Capital Works", "color": "blue"},
      {"name": "Other", "color": "default"}
    ]}},
    "Status": {"select": {"options": [
      {"name": "On Track", "color": "green"},
      {"name": "Over Budget", "color": "red"},
      {"name": "Under Budget", "color": "blue"}
    ]}},
    "Notes": {"rich_text": {}}
  }
}' "Budget"

# ─── 4. Expenses ───────────────────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "💸 Expenses"}}],
  "properties": {
    "Description": {"title": {}},
    "Amount": {"number": {"format": "dollar"}},
    "Date": {"date": {}},
    "Category": {"select": {"options": [
      {"name": "Utilities", "color": "yellow"},
      {"name": "Maintenance", "color": "blue"},
      {"name": "Security", "color": "red"},
      {"name": "Insurance", "color": "purple"},
      {"name": "Cleaning", "color": "green"},
      {"name": "Landscaping", "color": "green"},
      {"name": "Administrative", "color": "gray"},
      {"name": "Legal", "color": "pink"},
      {"name": "Capital Works", "color": "blue"},
      {"name": "Other", "color": "default"}
    ]}},
    "Vendor": {"rich_text": {}},
    "Invoice Number": {"rich_text": {}},
    "Receipt": {"files": {}},
    "Payment Method": {"select": {"options": [
      {"name": "Cash", "color": "green"},
      {"name": "Bank Transfer", "color": "blue"},
      {"name": "Check", "color": "gray"},
      {"name": "Credit Card", "color": "purple"}
    ]}},
    "Paid From": {"select": {"options": [
      {"name": "Operating Account", "color": "blue"},
      {"name": "Petty Cash", "color": "green"},
      {"name": "Reserve Fund", "color": "orange"}
    ]}},
    "Approved By": {"rich_text": {}},
    "Status": {"select": {"options": [
      {"name": "Pending", "color": "yellow"},
      {"name": "Approved", "color": "blue"},
      {"name": "Paid", "color": "green"},
      {"name": "Disputed", "color": "red"},
      {"name": "Voided", "color": "gray"}
    ]}},
    "Fiscal Year": {"number": {"format": "number"}},
    "Quarter": {"select": {"options": [
      {"name": "Q1", "color": "blue"},
      {"name": "Q2", "color": "green"},
      {"name": "Q3", "color": "yellow"},
      {"name": "Q4", "color": "orange"}
    ]}},
    "Is Extraordinary": {"checkbox": {}},
    "Notes": {"rich_text": {}}
  }
}' "Expenses"

# ─── 5. Maintenance Requests ──────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "🔧 Maintenance Requests"}}],
  "properties": {
    "Request": {"title": {}},
    "Priority": {"select": {"options": [
      {"name": "Emergency 🔴", "color": "red"},
      {"name": "High 🟠", "color": "orange"},
      {"name": "Medium 🟡", "color": "yellow"},
      {"name": "Low 🟢", "color": "green"}
    ]}},
    "Status": {"select": {"options": [
      {"name": "New", "color": "gray"},
      {"name": "Assigned", "color": "blue"},
      {"name": "In Progress", "color": "yellow"},
      {"name": "Waiting on Parts", "color": "orange"},
      {"name": "Completed", "color": "green"},
      {"name": "Closed", "color": "default"},
      {"name": "Cancelled", "color": "red"}
    ]}},
    "Category": {"select": {"options": [
      {"name": "Plumbing", "color": "blue"},
      {"name": "Electrical", "color": "yellow"},
      {"name": "HVAC", "color": "orange"},
      {"name": "Structural", "color": "red"},
      {"name": "Roofing", "color": "brown"},
      {"name": "Appliance", "color": "purple"},
      {"name": "Common Area", "color": "green"},
      {"name": "Elevator", "color": "gray"},
      {"name": "Pool", "color": "blue"},
      {"name": "Generator", "color": "orange"},
      {"name": "Security System", "color": "red"},
      {"name": "Pest Control", "color": "brown"},
      {"name": "Painting", "color": "yellow"},
      {"name": "Other", "color": "default"}
    ]}},
    "Location": {"rich_text": {}},
    "Reported By": {"rich_text": {}},
    "Reported Date": {"date": {}},
    "Assigned To": {"rich_text": {}},
    "Contractor Phone": {"phone_number": {}},
    "Estimated Cost": {"number": {"format": "dollar"}},
    "Actual Cost": {"number": {"format": "dollar"}},
    "Quote Amount": {"number": {"format": "dollar"}},
    "Quote Received": {"checkbox": {}},
    "Approved": {"checkbox": {}},
    "Completed Date": {"date": {}},
    "Warranty": {"rich_text": {}},
    "Photos Before": {"files": {}},
    "Photos After": {"files": {}},
    "Notes": {"rich_text": {}}
  }
}' "Maintenance Requests"

# ─── 6. Works & Projects ──────────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "🏗️ Works & Projects"}}],
  "properties": {
    "Project": {"title": {}},
    "Description": {"rich_text": {}},
    "Contractor": {"rich_text": {}},
    "Quoted Amount": {"number": {"format": "dollar"}},
    "Vote Date": {"date": {}},
    "Vote Type": {"select": {"options": [
      {"name": "AGM", "color": "blue"},
      {"name": "Electronic Vote", "color": "green"},
      {"name": "Extraordinary Assembly", "color": "purple"}
    ]}},
    "Vote Result": {"rich_text": {}},
    "Status": {"select": {"options": [
      {"name": "Proposed", "color": "gray"},
      {"name": "Approved", "color": "blue"},
      {"name": "Contractor Selected", "color": "yellow"},
      {"name": "In Progress", "color": "orange"},
      {"name": "Completed", "color": "green"},
      {"name": "On Hold", "color": "red"},
      {"name": "Cancelled", "color": "default"}
    ]}},
    "Advance Paid (%)": {"number": {"format": "percent"}},
    "Advance Amount": {"number": {"format": "dollar"}},
    "Advance Date": {"date": {}},
    "Progress Paid (%)": {"number": {"format": "percent"}},
    "Progress Amount": {"number": {"format": "dollar"}},
    "Progress Date": {"date": {}},
    "Final Paid (%)": {"number": {"format": "percent"}},
    "Final Amount": {"number": {"format": "dollar"}},
    "Final Date": {"date": {}},
    "Owner Assessment Total": {"number": {"format": "dollar"}},
    "Per-Unit Breakdown": {"rich_text": {}},
    "Start Date": {"date": {}},
    "Expected Completion": {"date": {}},
    "Actual Completion": {"date": {}},
    "Warranty Expiry": {"date": {}},
    "Documents": {"files": {}},
    "Notes": {"rich_text": {}}
  }
}' "Works & Projects"

# ─── 7. Cash Position ─────────────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "🏦 Cash Position"}}],
  "properties": {
    "Account": {"title": {}},
    "Account Number": {"rich_text": {}},
    "Bank": {"rich_text": {}},
    "Account Type": {"select": {"options": [
      {"name": "Operating", "color": "blue"},
      {"name": "Savings", "color": "green"},
      {"name": "Petty Cash", "color": "yellow"},
      {"name": "Reserve Fund", "color": "orange"},
      {"name": "Escrow", "color": "purple"}
    ]}},
    "Currency": {"select": {"options": [
      {"name": "USD", "color": "green"},
      {"name": "EUR", "color": "blue"},
      {"name": "DOP", "color": "orange"},
      {"name": "GBP", "color": "purple"},
      {"name": "CAD", "color": "red"},
      {"name": "MXN", "color": "yellow"}
    ]}},
    "Current Balance": {"number": {"format": "dollar"}},
    "Last Updated": {"date": {}},
    "Signatory": {"rich_text": {}},
    "Notes": {"rich_text": {}}
  }
}' "Cash Position"

# ─── 8. Communications Log ────────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "📨 Communications Log"}}],
  "properties": {
    "Subject": {"title": {}},
    "Type": {"select": {"options": [
      {"name": "Fee Call", "color": "blue"},
      {"name": "Payment Reminder", "color": "yellow"},
      {"name": "Payment Confirmation", "color": "green"},
      {"name": "Financial Report", "color": "purple"},
      {"name": "Violation Notice", "color": "red"},
      {"name": "Meeting Notice", "color": "blue"},
      {"name": "Meeting Minutes", "color": "gray"},
      {"name": "Work Update", "color": "orange"},
      {"name": "Emergency Alert", "color": "red"},
      {"name": "General Notice", "color": "default"},
      {"name": "Legal Notice", "color": "pink"},
      {"name": "Welcome Letter", "color": "green"},
      {"name": "Year-End Statement", "color": "purple"}
    ]}},
    "Channel": {"select": {"options": [
      {"name": "Email", "color": "blue"},
      {"name": "WhatsApp", "color": "green"},
      {"name": "Letter", "color": "gray"},
      {"name": "In Person", "color": "yellow"},
      {"name": "Phone", "color": "orange"},
      {"name": "Posted Notice", "color": "default"}
    ]}},
    "Date": {"date": {}},
    "Direction": {"select": {"options": [
      {"name": "Sent", "color": "blue"},
      {"name": "Received", "color": "green"}
    ]}},
    "Content": {"rich_text": {}},
    "Attachments": {"files": {}},
    "Follow-up Required": {"checkbox": {}},
    "Follow-up Date": {"date": {}},
    "Follow-up Done": {"checkbox": {}},
    "Sent By": {"rich_text": {}}
  }
}' "Communications Log"

# ─── 9. Meetings ──────────────────────────────────────────────
create_database '{
  "parent": {"type": "page_id", "page_id": "'"$PARENT_PAGE_ID"'"},
  "title": [{"type": "text", "text": {"content": "📅 Meetings"}}],
  "properties": {
    "Meeting": {"title": {}},
    "Date": {"date": {}},
    "Type": {"select": {"options": [
      {"name": "AGM", "color": "blue"},
      {"name": "Extraordinary Assembly", "color": "purple"},
      {"name": "Board Meeting", "color": "green"},
      {"name": "Committee Meeting", "color": "yellow"}
    ]}},
    "Location": {"rich_text": {}},
    "Quorum Met": {"checkbox": {}},
    "Attendees": {"rich_text": {}},
    "Absent": {"rich_text": {}},
    "Proxies": {"rich_text": {}},
    "Agenda": {"rich_text": {}},
    "Minutes": {"rich_text": {}},
    "Resolutions": {"rich_text": {}},
    "Documents": {"files": {}},
    "Next Meeting": {"date": {}},
    "Action Items": {"rich_text": {}}
  }
}' "Meetings"

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🎉 All 9 databases created successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Database IDs (save these to MEMORY.md):"
echo "────────────────────────────────────────"
for name in "Units Registry" "Owner Ledger" "Budget" "Expenses" "Maintenance Requests" "Works & Projects" "Cash Position" "Communications Log" "Meetings"; do
  printf "  %-25s %s\n" "$name:" "${DB_IDS[$name]}"
done
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT — Manual steps required in Notion:${NC}"
echo ""
echo "  1. Add RELATION properties (can't be automated via API for new DBs):"
echo "     • Owner Ledger → Unit (relation to Units Registry)"
echo "     • Expenses → Unit (relation to Units Registry)"
echo "     • Expenses → Budget Line (relation to Budget)"
echo "     • Maintenance Requests → Unit (relation to Units Registry)"
echo "     • Maintenance Requests → Related Expense (relation to Expenses)"
echo "     • Works & Projects → (no relation needed)"
echo "     • Communications Log → Unit (relation to Units Registry)"
echo ""
echo "  2. Add FORMULA properties in Units Registry:"
echo "     • Monthly Fee = prop(\"Ownership Share (%)\") * [ANNUAL_BUDGET] / 12"
echo "     • Quarterly Fee = prop(\"Ownership Share (%)\") * [ANNUAL_BUDGET] / 4"
echo "     (Replace [ANNUAL_BUDGET] with your approved annual budget)"
echo ""
echo "  3. Share ALL databases with your Notion integration"
echo ""
echo "  4. Tell your OpenClaw agent:"
echo "     'Initialize Condo Manager OS with these database IDs: ...'"
echo ""
echo -e "${BLUE}Setup complete. Welcome to Condo Manager OS! 🏢${NC}"
