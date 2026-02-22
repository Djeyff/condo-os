#!/bin/bash
# Portal bot process controller
# Usage: portal-ctl.sh start|stop|restart|status
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$DIR/.portal.pid"
LOG="/tmp/portal-bot.log"
SCRIPT="$DIR/scripts/owner-portal.js"

is_running() {
  [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

do_start() {
  if is_running; then
    echo "Already running (PID $(cat "$PIDFILE"))"
    return 0
  fi
  echo "Starting portal bot..."
  cd "$DIR"
  setsid node "$SCRIPT" >> "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  sleep 2
  if is_running; then
    echo "✅ Started (PID $(cat "$PIDFILE"))"
  else
    echo "❌ Failed to start — check $LOG"
    rm -f "$PIDFILE"
    return 1
  fi
}

do_stop() {
  if ! is_running; then
    echo "Not running"
    rm -f "$PIDFILE"
    return 0
  fi
  local pid=$(cat "$PIDFILE")
  echo "Stopping PID $pid..."
  # Send SIGTERM to process group
  kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  # Wait up to 5s
  for i in 1 2 3 4 5; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
  echo "✅ Stopped"
}

do_status() {
  if is_running; then
    local pid=$(cat "$PIDFILE")
    echo "✅ Running (PID $pid)"
    ps -p "$pid" -o pid,etime,rss,%cpu,cmd --no-headers 2>/dev/null || true
  else
    echo "❌ Not running"
    rm -f "$PIDFILE"
  fi
}

case "${1:-status}" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; sleep 1; do_start ;;
  status)  do_status ;;
  *)       echo "Usage: $0 {start|stop|restart|status}" ;;
esac
