import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "./api/client";
import { failureOf } from "./api/errors";
import { useSession } from "./auth/SessionProvider";
import type { StoredSession } from "./auth/session";

/** The signed-in console. Organiser features join it in later tasks. */
export function Console({ session }: { session: StoredSession }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { signedOut } = useSession();

  const current = useQuery(trpc.auth.session.current.queryOptions(undefined, { retry: false }));
  const signOut = useMutation(
    trpc.auth.session.signOut.mutationOptions({
      onSettled() {
        signedOut();
        queryClient.clear();
      },
    }),
  );

  // A session kippu-api no longer recognises, or one that is not an organiser's, ends here.
  const rejected =
    (current.isError && failureOf(current.error).transport === "UNAUTHORIZED") ||
    (current.isSuccess && current.data.principal.kind !== "organiser");
  useEffect(() => {
    if (rejected) {
      signedOut();
      queryClient.clear();
    }
  }, [rejected, signedOut, queryClient]);

  return (
    <section className="panel">
      <h1>Ibento</h1>
      {current.isPending ? <p>Checking your session…</p> : null}
      {current.isError && !rejected ? (
        <p role="alert" className="error">
          Kippu could not be reached. Try again.
        </p>
      ) : null}
      {current.isSuccess && !rejected ? (
        <p>
          Signed in as <strong>{session.organiser.email}</strong>
        </p>
      ) : null}
      <button type="button" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
        Sign out
      </button>
    </section>
  );
}
