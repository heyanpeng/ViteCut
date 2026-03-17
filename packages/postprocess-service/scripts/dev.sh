#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

mkdir -p ../api/output

DEFAULT_MEDIA_ROOT="$(cd ../api/output && pwd)"
MEDIA_ROOT="${MEDIA_ROOT:-$DEFAULT_MEDIA_ROOT}"
PORT="${POSTPROCESS_SERVICE_PORT:-8010}"

echo "[postprocess-service] MEDIA_ROOT=$MEDIA_ROOT"
echo "[postprocess-service] PORT=$PORT"

exec env MEDIA_ROOT="$MEDIA_ROOT" POSTPROCESS_SERVICE_PORT="$PORT" .venv/bin/python app.py
