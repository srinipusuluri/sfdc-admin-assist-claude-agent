#!/usr/bin/env bash
# Start Salesforce Virtual Admin Assistant
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Salesforce Virtual Admin Assistant..."
echo ""

# Start backend
(cd "$ROOT/backend" && node server.js) &
BACKEND_PID=$!

# Give backend 2s to start
sleep 2

# Start frontend
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "  Backend  → http://localhost:3001"
echo "  Frontend → http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

cleanup() {
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "Stopped."
}
trap cleanup INT TERM
wait
