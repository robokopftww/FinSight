#!/usr/bin/env bash
set -euo pipefail

AI_INTERNAL_PORT="${AI_INTERNAL_PORT:-8000}"
export AI_SERVICE_URL="${AI_SERVICE_URL:-http://127.0.0.1:${AI_INTERNAL_PORT}}"

python -m uvicorn main:app \
  --app-dir ai-service \
  --host 127.0.0.1 \
  --port "${AI_INTERNAL_PORT}" &

AI_PID=$!

cleanup() {
  kill "${AI_PID}" 2>/dev/null || true
}

trap cleanup EXIT

npm run start --workspace backend
