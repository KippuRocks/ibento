# ibento

Ibento — the organiser console. Feature F-040.

This repository was reset for the V0 rebuild. The previous implementation is
preserved under the tag `legacy`.

Everything here is built from the Kippu specification and plan, in
`kippurocks/kippu-docs`: `SPEC.md` decides behaviour, `PLAN.md` and
`features/` decide how it is built. Work is tracked as one issue per feature
per milestone.

## What it is

A React single-page app, built with Vite (`AD-03`). Every organiser action
reaches Ticketto through `kippu-api`, which exercises the organiser's authority
on their behalf (`REQ-OA-1`): Ibento never embeds the Ticketto SDK and never
holds a key.

- **API** — the Kippu API's tRPC router (contract `C5`), typed by `@kippu/api`,
  called through `@trpc/client` with TanStack Query (`src/api/client.ts`). A
  failed call carries the `SPEC.md` §10 code, when there is one, in
  `error.data.errorCode`, and Ibento shows it verbatim.
- **Sign-in** — organisers sign up with an email and one passkey, then sign in
  with that passkey (`src/auth/`). The passkey is a Kippu login on Kippu's login
  relying party, never a ledger credential. The session is an opaque bearer
  token, kept in the tab's `sessionStorage` and sent as
  `Authorization: Bearer <token>`.

## Development

Requires Node 24 or later, pnpm (the version is pinned in `package.json`), and
Docker for the local test API's store.

```sh
pnpm install
pnpm lint        # Biome
pnpm typecheck
pnpm test        # Vitest
pnpm build       # emits dist/
pnpm test-api    # runs kippu-api on 127.0.0.1:8080 (see below)
pnpm dev         # serves the console on http://localhost:5173
pnpm e2e         # Playwright, against the test API
```

The development and preview servers forward `/v0/trpc` to a local kippu-api
(`KIPPU_API_URL`, default `http://127.0.0.1:8080`), so the console calls the API
at its own origin. How Ibento and kippu-api are served together outside local
development is a hosting decision that has not been taken.

### `@kippu/api`

`@kippu/api` is not published to a registry. It is vendored as a `pnpm pack`
tarball from a pinned `kippu-api` commit (`vendor/kippu-api/`):
`pnpm vendor:kippu-api <commit>` re-pins it, and `pnpm vendor:check` (run in CI)
rebuilds it at the recorded commit and fails if it differs.

### The test API

`tools/test-api.sh` runs the real kippu-api server at the same recorded commit,
built once into `.test-api/`, so the end-to-end tests exercise the server whose
types Ibento compiles against.

- **Store** — PostgreSQL. CI passes `KIPPU_DATABASE_URL` for a service
  container. Locally, without it, the script starts kippu-api's own compose
  store and uses an `ibento_e2e` database there.
- **Login relying party** — `KIPPU_LOGIN_RP_ID` defaults to `localhost`, and
  `KIPPU_LOGIN_ORIGINS` to Ibento's local origins, `http://localhost:5173` and
  `http://localhost:4173`. `KIPPU_HOLDER_RP_ID` is a placeholder kippu-api
  requires; Ibento never uses it. The real hostnames are not chosen yet.

Playwright starts the test API and the preview server itself, and gives
Chromium a virtual WebAuthn authenticator, so no person or device answers the
passkey prompts.
