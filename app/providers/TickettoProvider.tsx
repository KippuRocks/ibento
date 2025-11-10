"use client";

import { Binary, createClient } from "polkadot-api";
import {
  KippuConfig,
  KippuPAPIConsumer,
  isKreivoTx,
} from "@kippurocks/libticketto-papi";
import { useEffect, useState } from "react";

import { TickettoClientBuilder } from "@ticketto/protocol";
import { getWsProvider } from "polkadot-api/ws-provider";
import { TickettoClientProvider } from "./TickettoClientProvider";
import { PapiSigner } from "./PapiSigner";

export function TickettoProvider({
  account,
  children,
}: {
  account?: PapiSigner;
  children: React.ReactNode;
}) {
  const [builder, setBuilder] = useState<TickettoClientBuilder | undefined>(
    undefined
  );

  useEffect(() => {
    const accountProvider = account
      ? {
          getAccountId: () => {
            console.log("address", account.address);
            return account.address;
          },
          async sign<T>(payload: T) {
            if (!isKreivoTx(payload)) {
              throw new Error(
                "This `AccountProvider` is not compatible with the provided payload"
              );
            }

            const signature = await payload.sign(account.signer);
            return Binary.fromHex(signature).asBytes();
          },
        }
      : {
          getAccountId() {
            throw new Error("Account not provided");
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          sign<T>(_: T) {
            throw new Error("Account not provided");
          },
        };

    setBuilder(
      new TickettoClientBuilder().withConsumer(KippuPAPIConsumer).withConfig({
        consumerSettings: {
          api: {
            endpoint: process.env.NEXT_PUBLIC_KIPPU_API_ENDPOINT,
            clientId: process.env.NEXT_PUBLIC_KIPPU_API_CLIENT_ID,
            clientSecret: process.env.NEXT_PUBLIC_KIPPU_API_CLIENT_SECRET,
          },
          client: createClient(
            getWsProvider(
              process.env.NEXT_PUBLIC_CHAIN_ENDPOINT ??
                "wss://kreivo.kippu.rocks"
            )
          ),
          eventsContractAddress:
            process.env.NEXT_PUBLIC_EVENTS_CONTRACT_ADDRESS,
          ticketsContractAddress:
            process.env.NEXT_PUBLIC_TICKETS_CONTRACT_ADDRESS,
          merchantId: process.env.NEXT_PUBLIC_MERCHANT_ID,
        },
        accountProvider,
      } as KippuConfig)
    );
  }, [account]);

  return (
    builder && (
      <TickettoClientProvider builder={builder}>
        {children}
      </TickettoClientProvider>
    )
  );
}
