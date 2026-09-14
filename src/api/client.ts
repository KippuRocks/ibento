import type { AppRouter } from "@kippu/api";
import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

/**
 * Where Ibento reaches the Kippu API's tRPC router (`C5`): at its own origin.
 * The development and preview servers forward it to a local kippu-api
 * (`vite.config.ts`).
 */
export const API_PATH = "/v0/trpc";

export type KippuClient = TRPCClient<AppRouter>;

/**
 * A client for the `C5` contract. Every call carries the organiser's session
 * token, when there is one, as a bearer token. Ibento never holds a key: every
 * organiser action is exercised by kippu-api on the organiser's behalf
 * (`REQ-OA-1`).
 */
export function createKippuClient(url: string, token: () => string | null): KippuClient {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url,
        headers() {
          const current = token();
          return current === null ? {} : { authorization: `Bearer ${current}` };
        },
      }),
    ],
  });
}

/** TanStack Query over the same client. */
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
