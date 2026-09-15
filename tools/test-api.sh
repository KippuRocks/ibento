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
# The Kippu store is PostgreSQL; metadata and capacity-proof storage are S3-compatible
# (MinIO). CI passes KIPPU_DATABASE_URL and the KIPPU_METADATA_S3_*/KIPPU_PROOFS_S3_*
# keys for its own containers. Locally, this script never starts a container of its
# own — a laptop running several feature worktrees at once cannot spare one per
# repository. It reuses whatever the machine already has running: the shared Kippu
# store at KIPPU_DATABASE_URL's default below (one PostgreSQL instance every V0 repo
# reads and writes its own database on), and shared MinIO on 127.0.0.1:59000. Ibento
# gets its own database (dropped and recreated on every start) and its own buckets, so
# it never disturbs another repo's data on the same shared instances.
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

# The shared local Kippu store (started once, outside any repository, never by this
# script): Ibento gets its own database on it, recreated on every start.
if [[ -z "${KIPPU_DATABASE_URL:-}" ]]; then
  shared="${KIPPU_SHARED_DATABASE_URL:-postgres://kippu:kippu@127.0.0.1:55432/kippu}"
  database=ibento_e2e
  node -e '
    const { Client } = require("pg");
    const [admin, database] = process.argv.slice(1);
    (async () => {
      const client = new Client({ connectionString: admin });
      await client.connect();
      await client.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await client.query(`CREATE DATABASE ${database}`);
      await client.end();
    })().catch((error) => { console.error(error); process.exit(1); });
  ' "$shared" "$database" >&2
  export KIPPU_DATABASE_URL="${shared%/*}/$database"
fi

# The shared local MinIO (likewise, never started by this script): Ibento's own
# buckets, distinct from any other repository's, on whatever endpoint and root
# credentials it was started with.
if [[ -z "${KIPPU_METADATA_S3_BUCKET:-}" ]]; then
  export KIPPU_METADATA_S3_BUCKET=ibento-e2e-metadata
  export KIPPU_METADATA_S3_ENDPOINT="${KIPPU_SHARED_S3_ENDPOINT:-http://127.0.0.1:59000}"
  export KIPPU_METADATA_S3_FORCE_PATH_STYLE=true
  export KIPPU_METADATA_S3_ACCESS_KEY_ID="${KIPPU_SHARED_S3_ACCESS_KEY_ID:-kippu_metadata}"
  export KIPPU_METADATA_S3_SECRET_ACCESS_KEY="${KIPPU_SHARED_S3_SECRET_ACCESS_KEY:-kippu_metadata_local}"
fi
if [[ -z "${KIPPU_PROOFS_S3_BUCKET:-}" ]]; then
  export KIPPU_PROOFS_S3_BUCKET=ibento-e2e-proofs
fi
if [[ -z "${KIPPU_METADATA_S3_PROVISIONED:-}" ]]; then
  node -e '
    const {
      S3Client, CreateBucketCommand, HeadBucketCommand,
    } = require("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "us-east-1",
      forcePathStyle: true,
      endpoint: process.env.KIPPU_METADATA_S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.KIPPU_METADATA_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.KIPPU_METADATA_S3_SECRET_ACCESS_KEY,
      },
    });
    (async () => {
      for (const Bucket of [process.env.KIPPU_METADATA_S3_BUCKET, process.env.KIPPU_PROOFS_S3_BUCKET]) {
        try {
          await client.send(new HeadBucketCommand({ Bucket }));
        } catch {
          await client.send(new CreateBucketCommand({ Bucket }));
        }
      }
    })().catch((error) => { console.error(error); process.exit(1); });
  ' >&2
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
