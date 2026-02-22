#!/bin/bash
# Auto-restart wrapper for the Owner Portal bot
# Usage: ./start-portal.sh (runs in foreground) or setsid ./start-portal.sh &
cd "$(dirname "$0")/.."
LOG=/tmp/portal-bot.log

while true; do
  echo "[$(date -u)] Starting portal bot..." >> "$LOG"
  node scripts/owner-portal.js >> "$LOG" 2>&1
  EXIT=$?
  echo "[$(date -u)] Bot exited with code $EXIT, restarting in 5s..." >> "$LOG"
  sleep 5
done
