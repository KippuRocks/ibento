import { Binary, createClient } from "polkadot-api";
import {
  KippuAccountProvider,
  KippuConsumerSettings,
  KippuPAPIConsumer,
  isKreivoTx,
} from "@kippurocks/libticketto-papi";

import { TickettoClientBuilder } from "@ticketto/protocol";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { keyring } from "./signer.js";

// Setup the app authenticator.
export const papiClient = createClient(
  getWsProvider(
    // "wss://testnet.kreivo.kippu.rocks",
    "ws://127.0.0.1:21000"
  )
);

// Initialize the ticketto client.
export const client = await new TickettoClientBuilder()
  .withConsumer(KippuPAPIConsumer)
  .withConfig({
    accountProvider: {
      getAccountId() {
        return keyring.Alice.address;
      },
      async sign<T>(payload: T) {
        if (!isKreivoTx(payload)) {
          throw new Error("Cannot sign payload");
        }

        return Binary.fromHex(
          await payload.sign(keyring.Alice.signer)
        ).asBytes();
      }
    } as KippuAccountProvider,
    consumerSettings: {
      client: papiClient,
      apiEndpoint: "https://api.kippu.rocks",
      eventsContractAddress: "EafZgeorhvDpUssErFTPz1Gme3gTdE3Sg3Y9fgNCF4tHmfz",
      ticketsContractAddress: "GfMJAoBe5TTMQGYpnBj6xtjSyjUCYj99p5gZDev8Tt1wcbp",
      merchantId: 1,
    } as KippuConsumerSettings,
  })
  .build();
