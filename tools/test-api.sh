#!/usr/bin/env bash
# Runs kippu-api — the real server, at the commit vendor/kippu-api/source.json records —
# as the test API Ibento's end-to-end tests sign in against.
#
#   tools/test-api.sh
#
# The checkout is built once per recorded commit into .test-api/ (gitignored), so the
# server is the one whose router types Ibento compiles against.
#
# The Kippu store is PostgreSQL. CI passes KIPPU_DATABASE_URL for its service container;
# without it, the store is started locally from kippu-api's own compose file (Docker), and
# the server uses a database of its own there, so kippu-api development on the same store
# is not disturbed.
#
# Login passkeys are bound to KIPPU_LOGIN_RP_ID, and ceremonies are accepted only from
# KIPPU_LOGIN_ORIGINS. The defaults are Ibento's local origins on `localhost`. The holder
# RP id is a placeholder: kippu-api requires one, distinct from the login RP id, and
# Ibento never uses it. Real hostnames are not chosen yet.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
commit=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).commit)' "$root/vendor/kippu-api/source.json")
repository="https://github.com/KippuRocks/kippu-api.git"
dir="$root/.test-api/kippu-api"
stamp="$root/.test-api/built-commit"

if [[ ! -f "$stamp" || "$(cat "$stamp")" != "$commit" ]]; then
  echo "building kippu-api at $commit" >&2
  rm -rf "$dir" "$stamp"
  mkdir -p "$dir"
  git init --quiet "$dir"
  git -C "$dir" fetch --quiet --depth 1 "$repository" "$commit"
  git -C "$dir" checkout --quiet --detach FETCH_HEAD
  (
    cd "$dir"
    pnpm install --frozen-lockfile >&2
    pnpm build >&2
  )
  echo "$commit" >"$stamp"
fi

cd "$dir"

if [[ -z "${KIPPU_DATABASE_URL:-}" ]]; then
  docker compose up -d --wait >&2
  database=ibento_e2e
  if [[ -z "$(docker compose exec -T kippu-store psql -U kippu_api -d kippu_api -tAc "SELECT 1 FROM pg_database WHERE datname = '$database'")" ]]; then
    docker compose exec -T kippu-store psql -U kippu_api -d kippu_api -c "CREATE DATABASE $database" >&2
  fi
  export KIPPU_DATABASE_URL="postgres://kippu_api:kippu_api_local@127.0.0.1:54329/$database"
fi

export KIPPU_LOGIN_RP_ID="${KIPPU_LOGIN_RP_ID:-localhost}"
export KIPPU_LOGIN_ORIGINS="${KIPPU_LOGIN_ORIGINS:-http://localhost:5173,http://localhost:4173}"
export KIPPU_HOLDER_RP_ID="${KIPPU_HOLDER_RP_ID:-holder.kippu.example}"
export HOST="${KIPPU_API_HOST:-127.0.0.1}"
export PORT="${KIPPU_API_PORT:-8080}"

node dist/store/migrate-cli.js >&2
exec node dist/server.js
