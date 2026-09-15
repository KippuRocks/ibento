import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "./api/client";
import { failureOf } from "./api/errors";
import { useSession } from "./auth/SessionProvider";
import type { StoredSession } from "./auth/session";
import { EditEventPage } from "./events/EditEventPage";
import { EventPage } from "./events/EventPage";
import { EventsPage } from "./events/EventsPage";
import { NewEventWizard } from "./events/NewEventWizard";
import { GuestListPage } from "./guests/GuestListPage";
import { type Location, transition, useLocation } from "./screens/router";
import { ScreenLink } from "./screens/ScreenLink";

function Page({ location }: { location: Location }) {
  const event = location.params.event ?? "";
  switch (location.screen) {
    case "events.list":
      return <EventsPage />;
    case "event.create.details":
    case "event.create.zones":
    case "event.create.capacity":
    case "event.create.review":
      return <NewEventWizard />;
    case "event.detail":
      return <EventPage key={event} event={event} />;
    case "event.edit":
      return <EditEventPage key={event} event={event} />;
    case "event.guests":
    case "event.guests.link":
      return <GuestListPage key={event} event={event} />;
  }
}

/** The signed-in console. */
export function Console({ session }: { session: StoredSession }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { signedOut } = useSession();
  const location = useLocation();

  const current = useQuery(trpc.auth.session.current.queryOptions(undefined, { retry: false }));
  const signOut = useMutation(
    trpc.auth.session.signOut.mutationOptions({
      onSettled() {
        transition("chrome:console", "auth.sign-in");
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
      transition("chrome:console", "auth.sign-in");
      signedOut();
      queryClient.clear();
    }
  }, [rejected, signedOut, queryClient]);

  return (
    <>
      <header className="console-header">
        <ScreenLink from="chrome:console" to="events.list" params={{}} className="brand">
          Ibento
        </ScreenLink>
        <nav>
          <ScreenLink from="chrome:console" to="events.list" params={{}}>
            Your events
          </ScreenLink>
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
        {current.isSuccess && !rejected ? <Page location={location} /> : null}
      </div>
    </>
  );
}
