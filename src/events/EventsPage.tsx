import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { Screen } from "../screens/Screen";
import { ScreenLink } from "../screens/ScreenLink";
import { eventName } from "./view";

/** The events the organiser's ledger account owns, read from Kippu's derived copy. */
export function EventsPage() {
  const trpc = useTRPC();
  const mine = useQuery(trpc.derived.events.mine.queryOptions());

  return (
    <Screen id="events.list">
      <div className="heading-row">
        <h1>Your events</h1>
        <ScreenLink from="events.list" to="event.create.details" params={{}} className="button">
          New event
        </ScreenLink>
      </div>
      {mine.isPending ? <p>Loading your events…</p> : null}
      {mine.isError ? (
        <p role="alert" className="error">
          {describeFailure(mine.error)}
        </p>
      ) : null}
      {mine.isSuccess && mine.data.events.length === 0 ? <p>You have no events yet.</p> : null}
      {mine.isSuccess && mine.data.events.length > 0 ? (
        <ul className="events">
          {mine.data.events.map((event) => (
            <li key={event.id}>
              <ScreenLink from="events.list" to="event.detail" params={{ event: event.id }}>
                {eventName(event)}
              </ScreenLink>{" "}
              <span className="status">{event.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Screen>
  );
}
