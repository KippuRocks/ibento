import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { ClassesSection } from "../classes/ClassesSection";
import { PassWindowSection } from "../passes/PassWindowSection";
import { SaleSection } from "../sales/SaleSection";
import { Screen } from "../screens/Screen";
import { ScreenLink } from "../screens/ScreenLink";
import { CapacitySection } from "./CapacitySection";
import { LifecycleSection } from "./LifecycleSection";
import { documentText, type EventView, eventName } from "./view";

function SeatPositionCount({ event, zone }: { event: string; zone: string }) {
  const trpc = useTRPC();
  const positions = useQuery(trpc.events.zones.seatPositions.queryOptions({ event, zone }));
  if (positions.isPending) {
    return <>…</>;
  }
  if (positions.isError) {
    return <>{describeFailure(positions.error)}</>;
  }
  const count = positions.data.positions.length;
  return <>{count === 1 ? "1 seat position" : `${count} seat positions`}</>;
}

function Facts({ event }: { event: EventView }) {
  return (
    <>
      <dl className="facts">
        <dt>Status</dt>
        <dd data-testid="event-status">{event.status}</dd>
        <dt>Owner</dt>
        <dd>
          <code data-testid="event-owner">{event.owner}</code>
        </dd>
        <dt>Capacity</dt>
        <dd>{event.maxCapacity === null ? "Unbounded" : event.maxCapacity}</dd>
        <dt>Tickets issued</dt>
        <dd>{event.issued}</dd>
        <dt>Event id</dt>
        <dd>
          <code>{event.id}</code>
        </dd>
      </dl>
      <h2>Zones</h2>
      {event.zones.length === 0 ? (
        <p>This event has no zones.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Zone</th>
              <th scope="col">Kind</th>
              <th scope="col">Seats</th>
            </tr>
          </thead>
          <tbody>
            {event.zones.map((zone) => (
              <tr key={zone.id}>
                <td>{documentText(event.metadata, "zones", zone.id, "name") ?? "Unnamed zone"}</td>
                <td>{zone.kind}</td>
                <td>
                  {zone.kind === "Seated" ? (
                    <SeatPositionCount event={event.id} zone={zone.id} />
                  ) : (
                    "General admission"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** One event: its ledger facts, as Kippu's derived copy holds them, and its document. */
export function EventPage({ event }: { event: string }) {
  return (
    <Screen id="event.detail">
      <EventDetail event={event} />
    </Screen>
  );
}

function EventDetail({ event: id }: { event: string }) {
  const trpc = useTRPC();
  const read = useQuery(
    trpc.derived.events.get.queryOptions(
      { event: id },
      // The copy trails the ledger (NFR-11): until it has read the event, ask again.
      { refetchInterval: (query) => (query.state.data?.event === null ? 1000 : false) },
    ),
  );

  if (read.isPending) {
    return <p>Loading the event…</p>;
  }
  if (read.isError) {
    return (
      <p role="alert" className="error">
        {describeFailure(read.error)}
      </p>
    );
  }
  const { event } = read.data;
  if (event === null) {
    return <p>Kippu's copy of the ledger has not recorded this event yet.</p>;
  }
  const description = documentText(event.metadata, "description");
  return (
    <section>
      <div className="heading-row">
        <h1>{eventName(event)}</h1>
        <ScreenLink
          from="event.detail"
          to="event.edit"
          params={{ event: event.id }}
          className="button"
        >
          Edit details
        </ScreenLink>
        <ScreenLink
          from="event.detail"
          to="event.guests"
          params={{ event: event.id }}
          className="button"
        >
          Guest list
        </ScreenLink>
        <ScreenLink
          from="event.detail"
          to="event.operators"
          params={{ event: event.id }}
          className="button"
        >
          Gate access
        </ScreenLink>
        <ScreenLink
          from="event.detail"
          to="event.flags"
          params={{ event: event.id }}
          className="button"
        >
          Admission flags
        </ScreenLink>
      </div>
      {description === null ? null : <p>{description}</p>}
      <Facts event={event} />
      <LifecycleSection event={event} />
      <CapacitySection event={event} />
      <PassWindowSection event={event.id} />
      <SaleSection event={event.id} />
      <ClassesSection event={event.id} />
      <p className="note">
        Read from Kippu's copy of the ledger. Where the copy and the ledger disagree, the ledger is
        right.
      </p>
    </section>
  );
}
