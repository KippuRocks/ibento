import { type ReactNode, useId } from "react";
import type { EventDetailsDraft, SessionDraft } from "./document";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: (id: string) => ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint === undefined ? null : <p className="hint">{hint}</p>}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} {...(hint === undefined ? {} : { hint })}>
      {(id) => (
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
      )}
    </Field>
  );
}

export function DetailsStep({
  details,
  onChange,
}: {
  details: EventDetailsDraft;
  onChange: (details: EventDetailsDraft) => void;
}) {
  const set = (key: keyof Omit<EventDetailsDraft, "sessions">) => (value: string) =>
    onChange({ ...details, [key]: value });
  const setSession = (index: number, session: SessionDraft) =>
    onChange({
      ...details,
      sessions: details.sessions.map((existing, at) => (at === index ? session : existing)),
    });
  return (
    <fieldset>
      <legend>Details</legend>
      <p className="hint">
        Everything here is public, and none of it is written to the ledger. You can change it at any
        time.
      </p>
      <TextField label="Event name" value={details.name} onChange={set("name")} required />
      <Field label="Description">
        {(id) => (
          <textarea
            id={id}
            rows={4}
            value={details.description}
            onChange={(event) => set("description")(event.target.value)}
          />
        )}
      </Field>
      <TextField
        label="Organiser trading name"
        value={details.tradingName}
        onChange={set("tradingName")}
        hint="The name you trade under, shown to the public. Not a person's own name."
      />
      <TextField label="Venue name" value={details.venueName} onChange={set("venueName")} />
      <TextField
        label="Street address"
        value={details.streetAddress}
        onChange={set("streetAddress")}
      />
      <TextField label="Town or city" value={details.locality} onChange={set("locality")} />
      <TextField label="Region" value={details.region} onChange={set("region")} />
      <TextField label="Postal code" value={details.postalCode} onChange={set("postalCode")} />
      <TextField
        label="Country code"
        value={details.country}
        onChange={(value) => set("country")(value.toUpperCase())}
        placeholder="ES"
      />
      <TextField
        label="Time zone"
        value={details.timeZone}
        onChange={set("timeZone")}
        placeholder="Europe/Madrid"
      />
      <h3>Sessions</h3>
      <p className="hint">Times are in this browser's time zone.</p>
      {details.sessions.map((session, index) => (
        // Sessions have no identity of their own; their position is it.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <div className="group" key={index}>
          <TextField
            label={`Session ${index + 1} name`}
            value={session.name}
            onChange={(name) => setSession(index, { ...session, name })}
          />
          <TextField
            label={`Session ${index + 1} starts`}
            type="datetime-local"
            value={session.startsAt}
            onChange={(startsAt) => setSession(index, { ...session, startsAt })}
          />
          <TextField
            label={`Session ${index + 1} ends`}
            type="datetime-local"
            value={session.endsAt}
            onChange={(endsAt) => setSession(index, { ...session, endsAt })}
          />
          <button
            type="button"
            onClick={() =>
              onChange({ ...details, sessions: details.sessions.filter((_, at) => at !== index) })
            }
          >
            Remove session {index + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...details,
            sessions: [...details.sessions, { name: "", startsAt: "", endsAt: "" }],
          })
        }
      >
        Add a session
      </button>
    </fieldset>
  );
}
