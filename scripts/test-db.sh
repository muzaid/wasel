#!/usr/bin/env bash
# Runs the Wasel database test suite on a throw-away local PostgreSQL database.
# Usage: DB_URL=postgresql://postgres:postgres@localhost:5432/postgres scripts/test-db.sh
set -uo pipefail
cd "$(dirname "$0")/.."
ADMIN_URL="${DB_URL:-postgresql:///postgres}"
psql "$ADMIN_URL" -q -c "drop database if exists wasel_test" -c "create database wasel_test" || exit 1
TEST_URL="${ADMIN_URL%/*}/wasel_test"
LOG=$(mktemp)
for f in supabase/tests/00_supabase_stub.sql supabase/schema.sql supabase/migrations/*.sql supabase/tests/10_*.sql; do
  echo "→ $f"
  if ! psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f" >"$LOG" 2>&1; then
    grep -vE "NOTICE:  .*(already exists|does not exist)" "$LOG"; echo "FAILED in $f"; exit 1
  fi
  grep -E "PASS|FAIL|PASSED|ERROR" "$LOG" | sed 's/^.*NOTICE:  /  /' || true
done
