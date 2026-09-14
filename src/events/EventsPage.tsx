import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { hrefOf } from "../routing";
import { eventName } from "./view";

/** The events the organiser's ledger account owns, read from Kippu's derived copy. */
export function EventsPage() {
  const trpc = useTRPC();
  const mine = useQuery(trpc.derived.events.mine.queryOptions());

  return (
    <section>
      <div className="heading-row">
        <h1>Your events</h1>
        <a className="button" href={hrefOf({ name: "new-event" })}>
          New event
        </a>
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
              <a href={hrefOf({ name: "event", event: event.id })}>{eventName(event)}</a>{" "}
              <span className="status">{event.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
