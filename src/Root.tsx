import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import type { KippuClient } from "./api/client";
import { TRPCProvider } from "./api/client";
import { SessionProvider } from "./auth/SessionProvider";
import type { SessionStore } from "./auth/session";
import { ReviewerApp } from "./reviewer/ReviewerApp";
import { ReviewerSessionProvider } from "./reviewer/ReviewerSessionProvider";
import type { ReviewerSessionStore } from "./reviewer/session";
import { useReviewerArea } from "./screens/router";

interface RootProps {
  readonly organiser: {
    readonly client: KippuClient;
    readonly sessions: SessionStore;
    readonly queryClient: QueryClient;
  };
  readonly reviewer: {
    readonly client: KippuClient;
    readonly sessions: ReviewerSessionStore;
    readonly queryClient: QueryClient;
  };
}

/**
 * Ibento is two areas at one origin, chosen by the URL and never linked to each
 * other: the organiser console, and Kippu's internal reviewer portal
 * (`T-021-16`, `T-021-08`; `F-021` plan §5.4). Each keeps its own session, under
 * its own storage key, its own tRPC client and its own query cache — the two
 * name the same procedures (`auth.session.current` among them), and a shared
 * cache would answer a reviewer's query with an organiser's stale result, or
 * the reverse. `Console` and `ReviewerConsole` each also refuse the other
 * kind's session outright, in case a stray link or a shared bookmark ever
 * crosses over.
 */
export function Root({ organiser, reviewer }: RootProps) {
  const reviewerArea = useReviewerArea();
  if (reviewerArea) {
    return (
      <QueryClientProvider client={reviewer.queryClient}>
        <TRPCProvider trpcClient={reviewer.client} queryClient={reviewer.queryClient}>
          <ReviewerSessionProvider store={reviewer.sessions}>
            <ReviewerApp />
          </ReviewerSessionProvider>
        </TRPCProvider>
      </QueryClientProvider>
    );
  }
  return (
    <QueryClientProvider client={organiser.queryClient}>
      <TRPCProvider trpcClient={organiser.client} queryClient={organiser.queryClient}>
        <SessionProvider store={organiser.sessions}>
          <App />
        </SessionProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
