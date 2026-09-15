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
// The stand-in listens on 127.0.0.1 only, on KIPPU_HOLDER_STANDIN_PORT (default 8089):
//   POST /holders   →   { "account": "<hex>", "token": "<holder session token>" }

import { createServer as createHttpServer } from "node:http";
import { signProofOfControl } from "@ticketto/profile-v0";
import { simulatedWebAuthnSigner } from "@ticketto/profile-v0/testing";
import { loadConfig } from "./dist/config.js";
import { loadMetadataConfig, loadMetadataPublicUrl } from "./dist/metadata/config.js";
import { createS3MetadataStorage } from "./dist/metadata/storage.js";
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
const server = createServer(
  config,
  store,
  { logger: true },
  {
    metadataPublicUrl: loadMetadataPublicUrl(),
    ...(storage === undefined ? {} : { metadataStorage: storage }),
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
  return { account: linked.holder.account, token: linked.session.token };
}

const standIn = createHttpServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/holders") {
    response.writeHead(404).end();
    return;
  }
  linkHolder().then(
    (holder) => {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(holder));
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
