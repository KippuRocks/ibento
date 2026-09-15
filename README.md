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
- **Events** — `#/events` lists the events the organiser's ledger account owns,
  read from Kippu's derived copy of the ledger (`derived.events.mine`).
  `#/events/new` is the creation wizard (`US-A1`): details for the event's public
  metadata document, zones with their kinds (`REQ-ID-7`), canonical seat
  positions for seated zones, and an optional capacity. `#/events/<id>` shows the
  event's ledger facts and document as the derived copy holds them.
  - Seat positions are one designation per line, taken exactly as written: case
    and spaces count, so `C-14`, `c14` and `C-14 ` are three seats.
  - Creation is a ledger write, then a document write and seat-position uploads,
    which are not. If a later step fails, retrying repeats only the later steps.
- **Editing** — `#/events/<id>/edit` edits the event's public document
  (`US-A3`) through `metadata.events.put`: details, zone names and images. It
  starts from the document the event has, and keeps the fields it does not
  edit, such as seat map references. Images are JPEG, PNG or WebP of at most
  2 MiB, uploaded through `metadata.images.upload` to the metadata origin; SVG
  is refused. Editing writes nothing to the ledger (`AC-A3.1`).
- **Ticket classes** — on the event page (`US-B2`): several classes per event
  (`REQ-TC-1`), each with a name, description, provenance, attendance policy,
  restrictions and an optional quota, defined through `events.classes.define`.
  A `Purchased` class with a restriction is refused by the form before anything
  is sent, and the form says why (`REQ-TC-3`); kippu-api refuses it too, with
  `ERR-RestrictionNotPermitted`. `Cannot be transferred` carries
  `Cannot be resold` with it (`REQ-TK-2`).

## Screens

Every screen has a stable `screenId`, carried in the rendered tree as
`data-screen`, and `screens.json` lists them all with their routes, titles and
the screens each can navigate to (`F-070` plan §5.4). `kippu-e2e` merges it into
the navigation map.

- **The router is the table** in `src/screens/registry.ts`: each screen's id,
  title, route and chrome. The router resolves a URL to the first screen
  declared for its route; a multi-step flow's steps share one route. Ids name
  what the screen is for, as `area.subject.step`, never copy or indices, and
  are not renamed once used.
- **Every screen renders inside `<Screen id>`**, which sets `data-screen` and
  the document title.
- **Every navigation declares its edge**, naming both screens literally:
  `<ScreenLink from to params>` for links, `navigate(from, to, params)` from
  code, and `transition(from, to)` where the screen changes without the router
  (a wizard step, signing in or out). `from` may be a chrome, such as
  `chrome:console` for the header, whose edges belong to every screen inside it.
- **`pnpm screens:write`** regenerates `screens.json`. **`pnpm screens:check`**
  (CI) fails when it is out of date, when a navigation names a screen
  non-literally or one the router lacks, and when anything navigates around the
  declarations: an `<a href>`, `window.location`, or `hrefOf` outside
  `src/screens/`.
- **`e2e/screens.spec.ts`** walks the console through every screen in
  `screens.json`, and fails if a step shows no `data-screen`, more than one, or
  one not in the manifest; if a transition taken is not declared; or if any
  manifest screen is never reached.

## Development

Requires Node 24 or later, pnpm (the version is pinned in `package.json`), and
Docker for the local test API's store and metadata storage.

```sh
pnpm install
pnpm lint        # Biome
pnpm typecheck
pnpm test        # Vitest
pnpm screens:check  # screens.json matches the router and the declared navigation
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

- **Ledger** — kippu-api's development wiring
  (`KIPPU_LEDGER_ENVIRONMENT=development`): `backend-memory`, a software KMS for
  organiser keys and a development sponsor, all in the server's memory and lost
  when it exits.
- **Store** — PostgreSQL. CI passes `KIPPU_DATABASE_URL` for a service
  container. Locally, without it, the script starts kippu-api's own compose
  store and recreates an `ibento_e2e` database there on every start, since the
  in-memory ledger starts empty too.
- **Metadata storage** — MinIO, an S3-compatible stand-in: CI runs the image
  kippu-api's CI pins by digest and passes the `KIPPU_METADATA_S3_*` keys.
  Locally, without them, kippu-api's compose file runs MinIO with the
  `kippu-metadata` bucket. `KIPPU_METADATA_PUBLIC_URL` defaults to
  `https://meta.kippu.rocks`, the origin locators name (`AD-22`); no object
  store, CDN or DNS record exists for it yet.
- **Login relying party** — `KIPPU_LOGIN_RP_ID` defaults to `localhost`, and
  `KIPPU_LOGIN_ORIGINS` to Ibento's local origins, `http://localhost:5173` and
  `http://localhost:4173`. `KIPPU_HOLDER_RP_ID` is a placeholder kippu-api
  requires; Ibento never uses it. The real hostnames are not chosen yet.

The end-to-end tests run on one worker: `AC-A3.1` counts the ledger records
written while an edit runs, which concurrent tests would disturb.

Playwright starts the test API and the preview server itself, and gives
Chromium a virtual WebAuthn authenticator, so no person or device answers the
passkey prompts.
