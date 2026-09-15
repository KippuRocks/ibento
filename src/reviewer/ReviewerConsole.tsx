import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "../api/client";
import { failureOf } from "../api/errors";
import { transition } from "../screens/router";
import { ReviewerQueuePage } from "./ReviewerQueuePage";
import { useReviewerSession } from "./ReviewerSessionProvider";
import type { StoredReviewerSession } from "./session";

/**
 * The signed-in reviewer console (`T-021-16`, `T-021-08`; `F-021` plan §5.4,
 * "Reviewers"): the capacity-proof review queue, and nothing else — reviewers
 * reach nothing an organiser does, and an organiser session is refused here
 * exactly as a reviewer session is refused in the organiser console.
 */
export function ReviewerConsole({ session }: { session: StoredReviewerSession }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { signedOut } = useReviewerSession();

  const current = useQuery(trpc.auth.session.current.queryOptions(undefined, { retry: false }));
  const signOut = useMutation(
    trpc.auth.session.signOut.mutationOptions({
      onSettled() {
        transition("chrome:reviewer", "reviewer.sign-in");
        signedOut();
        queryClient.clear();
      },
    }),
  );

  // A session kippu-api no longer recognises, or one that is not a reviewer's, ends here:
  // organiser sessions never reach the queue.
  const rejected =
    (current.isError && failureOf(current.error).transport === "UNAUTHORIZED") ||
    (current.isSuccess && current.data.principal.kind !== "reviewer");
  useEffect(() => {
    if (rejected) {
      transition("chrome:reviewer", "reviewer.sign-in");
      signedOut();
      queryClient.clear();
    }
  }, [rejected, signedOut, queryClient]);

  return (
    <>
      <header className="console-header">
        <span className="brand">Kippu operations</span>
        <span className="account">
          {current.isSuccess && !rejected ? (
            <>
              Signed in as <strong>{session.reviewer.email}</strong>
            </>
          ) : null}
          <button type="button" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
            Sign out
          </button>
        </span>
      </header>
      <div className="console-body">
        {current.isPending ? <p>Checking your session…</p> : null}
        {current.isError && !rejected ? (
          <p role="alert" className="error">
            Kippu could not be reached. Try again.
          </p>
        ) : null}
        {current.isSuccess && !rejected ? <ReviewerQueuePage /> : null}
      </div>
    </>
  );
}
