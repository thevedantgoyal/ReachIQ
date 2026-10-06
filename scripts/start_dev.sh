#!/usr/bin/env bash
# ReachIQ local dev: verify Postgres + Redis, sync DB, run API (Mac / zsh-friendly bash).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Created .env from .env.example — update secrets before production."
  else
    echo "ERROR: .env is missing and .env.example was not found." >&2
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set in .env." >&2
  exit 1
fi
if [[ -z "${REDIS_URL:-}" ]]; then
  echo "ERROR: REDIS_URL is not set in .env." >&2
  exit 1
fi

if ! command -v pg_isready &>/dev/null; then
  echo "ERROR: pg_isready not found. Install PostgreSQL client tools (e.g. brew install libpq && brew link --force libpq)." >&2
  exit 1
fi

read -r PGHOST PGPORT <<<"$(python3 -c "
from urllib.parse import urlparse
import os
u = urlparse(os.environ['DATABASE_URL'])
print((u.hostname or 'localhost'), (u.port or 5432))
")"

if ! pg_isready -h "$PGHOST" -p "$PGPORT" &>/dev/null; then
  echo "ERROR: PostgreSQL is not accepting connections at ${PGHOST}:${PGPORT} (from DATABASE_URL in .env)." >&2
  echo "       Start Postgres (e.g. brew services start postgresql@15) and retry." >&2
  exit 1
fi

if ! command -v redis-cli &>/dev/null; then
  echo "ERROR: redis-cli not found. Install Redis (e.g. brew install redis)." >&2
  exit 1
fi

REDIS_PING_OK=0
if redis-cli -u "$REDIS_URL" ping 2>/dev/null | grep -q PONG; then
  REDIS_PING_OK=1
else
  read -r RH RP <<<"$(python3 -c "
from urllib.parse import urlparse
import os
u = urlparse(os.environ['REDIS_URL'])
print((u.hostname or 'localhost'), (u.port or 6379))
")"
  if redis-cli -h "$RH" -p "$RP" ping 2>/dev/null | grep -q PONG; then
    REDIS_PING_OK=1
  fi
fi

if [[ "$REDIS_PING_OK" -ne 1 ]]; then
  echo "ERROR: Redis did not respond to PING (REDIS_URL from .env)." >&2
  echo "       Start Redis (e.g. brew services start redis) and retry." >&2
  exit 1
fi

if [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

if ! command -v alembic &>/dev/null; then
  echo "ERROR: alembic not on PATH. Activate .venv or run: pip install -r requirements.txt" >&2
  exit 1
fi

alembic upgrade head

if ! command -v uvicorn &>/dev/null; then
  echo "ERROR: uvicorn not on PATH. Activate .venv or run: pip install -r requirements.txt" >&2
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ReachIQ API is starting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  API:       http://localhost:8000"
echo "  Health:    http://localhost:8000/health"
echo "  API Docs:  http://localhost:8000/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exec uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
