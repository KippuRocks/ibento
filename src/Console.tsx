import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "./api/client";
import { failureOf } from "./api/errors";
import { useSession } from "./auth/SessionProvider";
import type { StoredSession } from "./auth/session";
import { EventPage } from "./events/EventPage";
import { EventsPage } from "./events/EventsPage";
import { NewEventWizard } from "./events/NewEventWizard";
import { hrefOf, type Route, useRoute } from "./routing";

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case "events":
      return <EventsPage />;
    case "new-event":
      return <NewEventWizard />;
    case "event":
      return <EventPage key={route.event} event={route.event} />;
  }
}

/** The signed-in console. */
export function Console({ session }: { session: StoredSession }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { signedOut } = useSession();
  const route = useRoute();

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
    <>
      <header className="console-header">
        <a className="brand" href={hrefOf({ name: "events" })}>
          Ibento
        </a>
        <nav>
          <a href={hrefOf({ name: "events" })}>Your events</a>
        </nav>
        <span className="account">
          {current.isSuccess && !rejected ? (
            <>
              Signed in as <strong>{session.organiser.email}</strong>
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
        {current.isSuccess && !rejected ? <Page route={route} /> : null}
      </div>
    </>
  );
}
