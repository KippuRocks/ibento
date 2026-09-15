import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { describeRestrictions } from "../classes/draft";
import { documentText, type EventView, eventName } from "../events/view";
import { transition } from "../screens/router";
import { Screen } from "../screens/Screen";
import { ScreenLink } from "../screens/ScreenLink";
import {
  describeStatus,
  type Invitation,
  invitationLink,
  PLACEHOLDER_SAIFU_LINK_BASE,
  seatConflict,
} from "./invitations";

const SAIFU_LINK_BASE = import.meta.env.SAIFU_LINK_BASE ?? PLACEHOLDER_SAIFU_LINK_BASE;

interface CreatedLink {
  readonly link: string;
  readonly guest: string | null;
}

function zoneName(event: EventView, zone: string): string {
  return documentText(event.metadata, "zones", zone, "name") ?? "Unnamed zone";
}

/** Shown once, right after an invitation is created: its token is never shown again. */
function InvitationLink({ created, onDone }: { created: CreatedLink; onDone: () => void }) {
  const linkId = useId();
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <section>
      <h2>Invitation link</h2>
      <p>
        Send this link to {created.guest ?? "the guest"}. It opens Saifu, where they link their
        account and the ticket is issued to it.
      </p>
      <div className="field">
        <label htmlFor={linkId}>Invitation link</label>
        <input
          id={linkId}
          readOnly
          value={created.link}
          onFocus={(focused) => focused.currentTarget.select()}
        />
      </div>
      <p role="alert" className="warning">
        This link is shown only this once. Kippu keeps no copy of it, so it cannot be shown again.
        If it is lost, create a new invitation.
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(created.link).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          Copy link
        </button>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>
      {copied === true ? <p role="status">Copied.</p> : null}
      {copied === false ? (
        <p role="status">The link could not be copied. Select it and copy it yourself.</p>
      ) : null}
    </section>
  );
}

function InvitationsTable({
  event,
  invitations,
  classNames,
}: {
  event: EventView;
  invitations: readonly Invitation[];
  classNames: ReadonlyMap<string, string>;
}) {
  if (invitations.length === 0) {
    return <p>No invitations yet.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Guest</th>
          <th scope="col">Class</th>
          <th scope="col">Zone</th>
          <th scope="col">Place</th>
          <th scope="col">Status</th>
          <th scope="col">Holder account</th>
          <th scope="col">Ticket</th>
        </tr>
      </thead>
      <tbody>
        {invitations.map((invitation) => (
          <tr key={invitation.id} data-testid="invitation">
            <td>{invitation.guest ?? "—"}</td>
            <td>{classNames.get(invitation.class) ?? "Unknown class"}</td>
            <td>{zoneName(event, invitation.zone)}</td>
            <td>
              {invitation.placement.kind === "Seated"
                ? invitation.placement.position
                : "General admission"}
            </td>
            <td>{describeStatus(invitation.status)}</td>
            <td>
              {invitation.holder === null ? "Not linked yet" : <code>{invitation.holder}</code>}
            </td>
            <td>{invitation.ticket === null ? "—" : <code>{invitation.ticket}</code>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InviteForm({
  event,
  invitations,
  onCreated,
}: {
  event: EventView;
  invitations: readonly Invitation[];
  onCreated: (created: CreatedLink) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ids = { class: useId(), zone: useId(), seat: useId(), seats: useId(), guest: useId() };
  const classes = useQuery(trpc.events.classes.list.queryOptions({ event: event.id }));
  const granted = (classes.data ?? []).filter((defined) => defined.provenance === "Granted");

  const [classId, setClassId] = useState("");
  const [zoneId, setZoneId] = useState(event.zones[0]?.id ?? "");
  const [seat, setSeat] = useState("");
  const [guest, setGuest] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const chosenClass = granted.find((defined) => defined.id === classId) ?? granted[0];
  const zone = event.zones.find((candidate) => candidate.id === zoneId);
  const seated = zone?.kind === "Seated";
  const positions = useQuery(
    trpc.events.zones.seatPositions.queryOptions(
      { event: event.id, zone: zone?.id ?? "" },
      { enabled: seated },
    ),
  );

  const create = useMutation(
    trpc.events.invitations.create.mutationOptions({
      onSuccess: async ({ token, invitation }) => {
        await queryClient.invalidateQueries({ queryKey: trpc.events.invitations.list.pathKey() });
        setSeat("");
        setGuest("");
        onCreated({ link: invitationLink(token, SAIFU_LINK_BASE), guest: invitation.guest });
      },
    }),
  );

  if (classes.isPending) {
    return <p>Loading classes…</p>;
  }
  if (granted.length === 0) {
    return (
      <p>
        Invitations issue tickets of a granted class. Define one on the{" "}
        <ScreenLink from="event.guests" to="event.detail" params={{ event: event.id }}>
          event page
        </ScreenLink>{" "}
        first.
      </p>
    );
  }
  if (event.zones.length === 0) {
    return <p>This event has no zones, so there is nowhere to place a guest.</p>;
  }

  const conflict = seated && seat !== "" && zone ? seatConflict(invitations, zone.id, seat) : null;

  function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    if (chosenClass === undefined || zone === undefined) {
      return;
    }
    if (seated && seat === "") {
      setProblem("Choose the guest's seat.");
      return;
    }
    setProblem(null);
    create.mutate({
      event: event.id,
      class: chosenClass.id,
      zone: zone.id,
      placement: seated ? { kind: "Seated", position: seat } : { kind: "Unseated" },
      guest: guest.trim() === "" ? null : guest.trim(),
    });
  }

  return (
    <form onSubmit={submit} aria-label="Invite a guest">
      <h2>Invite a guest</h2>
      <div className="field">
        <label htmlFor={ids.class}>Class</label>
        <select
          id={ids.class}
          value={chosenClass?.id ?? ""}
          onChange={(changed) => setClassId(changed.target.value)}
        >
          {granted.map((defined) => (
            <option key={defined.id} value={defined.id}>
              {defined.name} — {describeRestrictions(defined.restrictions)}
            </option>
          ))}
        </select>
        <p className="hint">The ticket is free: no payment of any kind is taken.</p>
      </div>
      <div className="field">
        <label htmlFor={ids.zone}>Zone</label>
        <select
          id={ids.zone}
          value={zone?.id ?? ""}
          onChange={(changed) => setZoneId(changed.target.value)}
        >
          {event.zones.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {zoneName(event, candidate.id)} ({candidate.kind})
            </option>
          ))}
        </select>
      </div>
      {seated ? (
        <div className="field">
          <label htmlFor={ids.seat}>Seat</label>
          <input
            id={ids.seat}
            list={ids.seats}
            value={seat}
            onChange={(changed) => setSeat(changed.target.value)}
          />
          <datalist id={ids.seats}>
            {(positions.data?.positions ?? []).map((position) => (
              <option key={position} value={position} />
            ))}
          </datalist>
          <p className="hint">One of the zone's seat positions.</p>
        </div>
      ) : null}
      {conflict === "open" ? (
        <p className="warning" data-testid="seat-conflict">
          Seat {seat} already has an open invitation. Only one ticket can exist for a seat:
          whichever invitation is redeemed first gets it, and the other is refused.
        </p>
      ) : null}
      {conflict === "redeemed" ? (
        <p className="warning" data-testid="seat-conflict">
          Seat {seat} has already been issued through an invitation. An invitation for it will be
          refused when redeemed.
        </p>
      ) : null}
      <div className="field">
        <label htmlFor={ids.guest}>Guest</label>
        <input
          id={ids.guest}
          value={guest}
          onChange={(changed) => setGuest(changed.target.value)}
        />
        <p className="hint">
          Who the invitation is for, for your own list. Kept by Kippu, shown only to you, and never
          written to the ledger.
        </p>
      </div>
      {problem !== null ? (
        <p role="alert" className="error">
          {problem}
        </p>
      ) : null}
      {create.isError ? (
        <p role="alert" className="error">
          {describeFailure(create.error)}
        </p>
      ) : null}
      <div className="actions">
        <button type="submit" disabled={create.isPending}>
          Create invitation
        </button>
      </div>
    </form>
  );
}

/** An event's guest list (`US-B2`, `REQ-TC-4`): invitations to its granted classes, and who redeemed each. */
export function GuestListPage({ event: id }: { event: string }) {
  const trpc = useTRPC();
  const read = useQuery(trpc.derived.events.get.queryOptions({ event: id }));
  const classes = useQuery(trpc.events.classes.list.queryOptions({ event: id }));
  // The guest links in Saifu, elsewhere: ask again while any invitation waits on them.
  const invitations = useQuery(
    trpc.events.invitations.list.queryOptions(
      { event: id, class: null },
      {
        refetchInterval: (query) =>
          (query.state.data ?? []).some(({ status }) => status === "open" || status === "redeeming")
            ? 3000
            : false,
      },
    ),
  );
  const [created, setCreated] = useState<CreatedLink | null>(null);

  const event = read.data?.event ?? null;
  const failure = read.error ?? invitations.error ?? classes.error;

  return (
    <Screen id={created === null ? "event.guests" : "event.guests.link"}>
      <div className="heading-row">
        <h1>Guest list{event === null ? "" : `: ${eventName(event)}`}</h1>
        {created === null ? (
          <ScreenLink from="event.guests" to="event.detail" params={{ event: id }}>
            Back to the event
          </ScreenLink>
        ) : null}
      </div>
      {failure ? (
        <p role="alert" className="error">
          {describeFailure(failure)}
        </p>
      ) : null}
      {read.isPending || invitations.isPending ? <p>Loading the guest list…</p> : null}
      {read.isSuccess && event === null ? (
        <p>Kippu's copy of the ledger has not recorded this event yet.</p>
      ) : null}
      {event !== null && created !== null ? (
        <InvitationLink
          created={created}
          onDone={() => {
            transition("event.guests.link", "event.guests");
            setCreated(null);
          }}
        />
      ) : null}
      {event !== null && invitations.isSuccess && created === null ? (
        <>
          <p className="hint">
            A guest follows their invitation link to Saifu and links their account there; the
            class's ticket is then issued to that account.
          </p>
          <InvitationsTable
            event={event}
            invitations={invitations.data}
            classNames={new Map((classes.data ?? []).map((defined) => [defined.id, defined.name]))}
          />
          <InviteForm
            event={event}
            invitations={invitations.data}
            onCreated={(link) => {
              transition("event.guests", "event.guests.link");
              setCreated(link);
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}
