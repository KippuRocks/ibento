import { Binary, createClient } from "polkadot-api";
import {
  KippuAccountProvider,
  KippuConsumerSettings,
  KippuPAPIConsumer,
  isKreivoTx,
} from "@kippurocks/libticketto-papi";

import { TickettoClientBuilder } from "@ticketto/protocol";
import { getWsProvider } from "polkadot-api/ws-provider";
import { keyring } from "./signer";

// Setup the app authenticator.
export const papiClient = createClient(
  getWsProvider(process.env.NEXT_PUBLIC_CHAIN_ENDPOINT ?? "")
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
      },
    } as KippuAccountProvider,
    consumerSettings: {
      client: papiClient,
      apiEndpoint: "https://api.kippu.rocks",
      eventsContractAddress: process.env.NEXT_PUBLIC_EVENTS_CONTRACT_ADDRESS,
      ticketsContractAddress: process.env.NEXT_PUBLIC_TICKETS_CONTRACT_ADDRESS,
      merchantId: 1,
    } as unknown as KippuConsumerSettings,
  })
  .build();
