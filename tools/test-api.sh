#!/usr/bin/env bash
# Runs kippu-api — the real server, at the commit vendor/kippu-api/source.json records —
# as the test API Ibento's end-to-end tests run against, with a stand-in for Saifu's side of
# holder linking on 127.0.0.1:8089 (see tools/test-api/harness.mjs).
#
#   tools/test-api.sh
#
# The checkout is built once per recorded commit into .test-api/ (gitignored), so the
# server is the one whose router types Ibento compiles against.
#
# The server runs its development wiring (KIPPU_LEDGER_ENVIRONMENT=development):
# backend-memory, a software KMS for organiser keys and a development sponsor, all in
# the server's memory. Ledger state is lost when it exits while the Kippu store keeps
# its rows, so every start begins from an empty store.
#
# The Kippu store is PostgreSQL and metadata storage is S3-compatible (MinIO). CI passes
# KIPPU_DATABASE_URL and the KIPPU_METADATA_S3_* keys for its own containers. Without
# them, both are started locally from kippu-api's own compose file (Docker); the server
# gets a database of its own there, recreated on every start, so kippu-api development
# on the same store is not disturbed.
#
# Login passkeys are bound to KIPPU_LOGIN_RP_ID, and ceremonies are accepted only from
# KIPPU_LOGIN_ORIGINS. The defaults are Ibento's local origins on `localhost`. The holder
# RP id is a placeholder: kippu-api requires one, distinct from the login RP id, and
# Ibento never uses it. Real hostnames are not chosen yet; no object store, CDN or DNS
# record exists either.
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

if [[ -z "${KIPPU_DATABASE_URL:-}" || -z "${KIPPU_METADATA_S3_BUCKET:-}" ]]; then
  # kippu-api's compose file: the Kippu store, and MinIO with the kippu-metadata bucket.
  docker compose up -d --wait >&2
fi

if [[ -z "${KIPPU_DATABASE_URL:-}" ]]; then
  database=ibento_e2e
  docker compose exec -T kippu-store psql -U kippu_api -d kippu_api -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS $database WITH (FORCE)" -c "CREATE DATABASE $database" >&2
  export KIPPU_DATABASE_URL="postgres://kippu_api:kippu_api_local@127.0.0.1:54329/$database"
fi

if [[ -z "${KIPPU_METADATA_S3_BUCKET:-}" ]]; then
  export KIPPU_METADATA_S3_BUCKET=kippu-metadata
  export KIPPU_METADATA_S3_ENDPOINT=http://127.0.0.1:59000
  export KIPPU_METADATA_S3_FORCE_PATH_STYLE=true
  export KIPPU_METADATA_S3_ACCESS_KEY_ID=kippu_metadata
  export KIPPU_METADATA_S3_SECRET_ACCESS_KEY=kippu_metadata_local
fi

export KIPPU_LEDGER_ENVIRONMENT=development
export KIPPU_METADATA_PUBLIC_URL="${KIPPU_METADATA_PUBLIC_URL:-https://meta.kippu.rocks}"
export KIPPU_LOGIN_RP_ID="${KIPPU_LOGIN_RP_ID:-localhost}"
export KIPPU_LOGIN_ORIGINS="${KIPPU_LOGIN_ORIGINS:-http://localhost:5173,http://localhost:4173}"
export KIPPU_HOLDER_RP_ID="${KIPPU_HOLDER_RP_ID:-holder.kippu.example}"
export HOST="${KIPPU_API_HOST:-127.0.0.1}"
export PORT="${KIPPU_API_PORT:-8080}"

node dist/store/migrate-cli.js >&2
# kippu-api's server with a stand-in for Saifu's holder linking (tools/test-api/harness.mjs).
cp "$root/tools/test-api/harness.mjs" ibento-test-api.mjs
exec node ibento-test-api.mjs
