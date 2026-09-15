// The test API's process: kippu-api's server, as its own src/server.ts composes it in
// development, plus a stand-in for Saifu's side of holder linking.
//
// tools/test-api.sh copies this file into the kippu-api checkout and runs it there, so
// it imports the built server (dist/) and the vendored Ticketto packages of that commit.
//
// Why a stand-in. A guest links a holder account in Saifu: Saifu registers its holder
// credential on the ledger, then proves control of the account to kippu-api
// (auth.holder.beginLink / completeLink) and receives a holder session. In development
// the ledger is backend-memory inside the server's process, which no other process can
// reach, and Saifu's handoff (T-030-10) is not built. So this process does Saifu's two
// steps for a test: it registers a simulated passkey credential on the server's ledger —
// as kippu-api's own development-wiring test does — and links it through kippu-api's
// public tRPC routes over HTTP. Everything after that, redemption included, is
// kippu-api's real API.
//
// The stand-in also does Saifu's other two direct-to-ledger jobs (`REQ-CL-1`), so
// T-040-14's end-to-end check of the transfer-before-recording flag (`REQ-OP-3`) can
// drive a real transfer and a real, refused pass presentation, rather than script an
// error code: Ibento never holds a holder's key, so nothing in Ibento itself could do
// either. Both act as a holder `/holders` already linked, by its account.
//
// It also wires private object storage for capacity-proof artefacts (`T-021-08`), over
// the same KIPPU_PROOFS_S3_* keys `tools/test-api.sh` sets: without it, a capacity
// increase request fails before it can be reviewed.
//
// It also stands in for whoever has deployment access to create a reviewer account
// (`T-021-16`): there is deliberately no HTTP path for that in kippu-api (`F-021` plan
// §5.4, "no admin surface in V0"), so a test creates one the same way the command line
// does — directly against the store, in this same process.
//
// The stand-in listens on 127.0.0.1 only, on KIPPU_HOLDER_STANDIN_PORT (default 8089):
//   POST /holders          →  { "account": "<hex>", "token": "<holder session token>" }
//   POST /transfers        →  { event, ticket, holder, receiver }
//                          →  { "ok": true, "cursor": "<...>" } | { "ok": false, "errorCode": "<§10 code>" }
//   POST /passes/submit    →  { ticket, holder, presentedAt? }
//                          →  { "ok": true, "passId": "<hex>", "presentedAt": <ms> }
//                             | { "ok": false, "errorCode": "<§10 code>", "passId": "<hex>", "presentedAt": <ms> }
//   POST /reviewers        →  { email }
//                          →  { "email": "<email>", "code": "<one-time code>", "codeExpiresAt": "<ISO 8601>" }

import { createServer as createHttpServer } from "node:http";
import { producePass, signProofOfControl } from "@ticketto/profile-v0";
import { simulatedWebAuthnSigner } from "@ticketto/profile-v0/testing";
import { loadConfig } from "./dist/config.js";
import { loadMetadataConfig, loadMetadataPublicUrl } from "./dist/metadata/config.js";
import { createS3MetadataStorage } from "./dist/metadata/storage.js";
import { createS3ProofArtefactStorage, loadProofStorageConfig } from "./dist/proofs/artefacts.js";
import { createReviewers } from "./dist/reviewers/service.js";
import { assertMigrated } from "./dist/store/migrate.js";
import { createStore } from "./dist/store/store.js";
import { createServer } from "./dist/wiring.js";

const config = loadConfig();
if (config.ledgerEnvironment !== "development") {
  throw new Error("the test API harness runs only the development wiring");
}
const store = createStore(config.databaseUrl);
const storage =
  process.env.KIPPU_METADATA_S3_BUCKET === undefined
    ? undefined
    : createS3MetadataStorage(loadMetadataConfig().storage);
const proofStorage =
  process.env.KIPPU_PROOFS_S3_BUCKET === undefined
    ? undefined
    : createS3ProofArtefactStorage(loadProofStorageConfig());
const server = createServer(
  config,
  store,
  { logger: true },
  {
    metadataPublicUrl: loadMetadataPublicUrl(),
    ...(storage === undefined ? {} : { metadataStorage: storage }),
    ...(proofStorage === undefined ? {} : { proofStorage }),
  },
);

await assertMigrated(store);
server.start();
await server.app.listen({ host: config.host, port: config.port });

const api = `http://127.0.0.1:${config.port}/v0/trpc`;
const hex = (bytes) => Buffer.from(bytes).toString("hex");
const bytes = (value) => Uint8Array.from(Buffer.from(value, "hex"));

async function call(path, input) {
  const response = await fetch(`${api}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  }
  return body.result.data;
}

// Every holder's signer, by account, for the lifetime of this process: so a later
// call from a test — a transfer, a pass — can act as a holder `/holders` already
// linked, exactly as Saifu would still hold that credential on the device.
const signers = new Map();

/** Saifu's side of linking: a credential on the ledger, then proof of control to kippu-api. */
async function linkHolder() {
  const holder = simulatedWebAuthnSigner({ rpId: config.holderRpId });
  const registered = await server.ledger.registerCredential(holder.signer, {
    account: holder.signer.account,
    registration: holder.registration,
  });
  if (!registered.ok) {
    throw new Error(`registerCredential failed: ${JSON.stringify(registered.error)}`);
  }
  const link = await call("auth.holder.beginLink", { account: holder.signer.account });
  const proof = await signProofOfControl(
    {
      audience: bytes(link.challenge.audience),
      nonce: bytes(link.challenge.nonce),
      expiresAt: link.challenge.expiresAt,
      account: link.challenge.account,
    },
    holder.signer,
  );
  const linked = await call("auth.holder.completeLink", {
    challengeId: link.challengeId,
    authorisation: hex(proof),
  });
  signers.set(linked.holder.account, holder.signer);
  return { account: linked.holder.account, token: linked.session.token };
}

function signerFor(account) {
  const signer = signers.get(account);
  if (signer === undefined) {
    throw new Error(`unknown holder ${account}: link it through POST /holders first`);
  }
  return signer;
}

/**
 * A holder transfers a ticket directly through the ledger (`REQ-CL-1`, `US-D1`), as
 * Saifu would, with no Kippu in the path. Answers the SDK's own verdict.
 */
async function transferTicket({ event, ticket, holder, receiver }) {
  const submission = await server.ledger.transferTicket(signerFor(holder), {
    event,
    ticket,
    receiver,
  });
  return submission.ok
    ? { ok: true, cursor: submission.value.cursor }
    : { ok: false, errorCode: submission.error.code };
}

/**
 * A holder produces and presents an access pass directly to the ledger (`REQ-AP-1`,
 * `REQ-CL-1`), exactly as Iriguchi's submission would: no Kippu in the path. Answers
 * the ledger's real verdict — `ERR-InvalidPass` when the ticket left this holder
 * before the ledger recorded it — for a test to report to `operators.reportAdmission`
 * as Iriguchi would report what it just saw.
 */
async function submitPass({ ticket, holder, presentedAt }) {
  const at = presentedAt ?? Date.now();
  const pass = await producePass({ ticket, holder, notBefore: at - 1_000 }, signerFor(holder));
  const submission = await server.ledger.submitAccessPass(pass, { presentedAt: at });
  return {
    ok: submission.ok,
    ...(submission.ok ? {} : { errorCode: submission.error.code }),
    passId: pass.pass.id,
    presentedAt: at,
  };
}

const reviewers = createReviewers({ store, relyingParty: config.login });

/**
 * Creates a reviewer account and issues its one-time enrolment code, exactly as
 * `pnpm reviewer:create --email <email>` does (`T-021-16`): the only way one is
 * made, by design. A test redeems the code through Ibento's own reviewer
 * enrolment screen, as a real reviewer would.
 */
async function createReviewer({ email }) {
  const created = await reviewers.create(email);
  return {
    email: created.reviewer.email,
    code: created.code,
    codeExpiresAt: created.codeExpiresAt,
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const ROUTES = {
  "POST /holders": () => linkHolder(),
  "POST /transfers": (body) => transferTicket(body),
  "POST /passes/submit": (body) => submitPass(body),
  "POST /reviewers": (body) => createReviewer(body),
};

const standIn = createHttpServer((request, response) => {
  const handler = ROUTES[`${request.method} ${request.url}`];
  if (handler === undefined) {
    response.writeHead(404).end();
    return;
  }
  readJsonBody(request)
    .then(handler)
    .then(
      (result) => {
        response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
      },
      (error) => {
        server.app.log.error(error);
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: String(error) }));
      },
    );
});
standIn.listen(Number(process.env.KIPPU_HOLDER_STANDIN_PORT ?? 8089), "127.0.0.1");

const shutdown = async () => {
  standIn.close();
  await server.close();
  await store.end();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
