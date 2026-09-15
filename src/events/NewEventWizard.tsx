import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTRPC, useTRPCClient } from "../api/client";
import { describeFailure } from "../api/errors";
import { navigate, transition } from "../screens/router";
import { Screen } from "../screens/Screen";
import { detailsProblems, type EventDetailsDraft, emptyDetails, eventDocument } from "./document";
import { DetailsStep, Field, TextField } from "./fields";
import { randomId32 } from "./ids";
import { parsePositions, uploadsOf } from "./positions";

type ZoneKind = "Seated" | "Unseated";

interface ZoneDraft {
  /** The `ZoneId`, chosen here: 32 random bytes (`REQ-ID-7`). */
  readonly id: string;
  readonly name: string;
  readonly kind: ZoneKind;
  /** A seated zone's canonical positions, one designation per line. */
  readonly positions: string;
}

/** Each step of the wizard is a screen of its own, at the wizard's one route. */
type Step =
  | "event.create.details"
  | "event.create.zones"
  | "event.create.capacity"
  | "event.create.review";

const STEPS: readonly { readonly step: Step; readonly title: string }[] = [
  { step: "event.create.details", title: "Details" },
  { step: "event.create.zones", title: "Zones" },
  { step: "event.create.capacity", title: "Capacity" },
  { step: "event.create.review", title: "Review" },
];

/** Where Next leads from each step, declared as the transitions they are. */
const NEXT: Readonly<Record<Step, Step | null>> = {
  "event.create.details": transition("event.create.details", "event.create.zones"),
  "event.create.zones": transition("event.create.zones", "event.create.capacity"),
  "event.create.capacity": transition("event.create.capacity", "event.create.review"),
  "event.create.review": null,
};

/** Where Back leads from each step. */
const BACK: Readonly<Record<Step, Step | null>> = {
  "event.create.details": null,
  "event.create.zones": transition("event.create.zones", "event.create.details"),
  "event.create.capacity": transition("event.create.capacity", "event.create.zones"),
  "event.create.review": transition("event.create.review", "event.create.capacity"),
};

/** Where a submission is: each stage after `creating` can be retried on its own. */
type Stage = "creating" | "describing" | "seating" | "reading";

const STAGE_TEXT: Record<Stage, string> = {
  creating: "Creating the event on the ledger…",
  describing: "Saving the event's details…",
  seating: "Uploading seat positions…",
  reading: "Waiting for Kippu's copy of the ledger to record the event…",
};

function zoneProblems(zones: readonly ZoneDraft[]): readonly string[] {
  return zones.flatMap((zone, index) =>
    zone.kind === "Seated"
      ? parsePositions(zone.positions).invalid.map(
          ({ line, reason }) => `Zone ${index + 1}: seat position on line ${line} is ${reason}.`,
        )
      : [],
  );
}

function ZonesStep({
  zones,
  onChange,
}: {
  zones: readonly ZoneDraft[];
  onChange: (zones: readonly ZoneDraft[]) => void;
}) {
  const setZone = (index: number, zone: ZoneDraft) =>
    onChange(zones.map((existing, at) => (at === index ? zone : existing)));
  return (
    <fieldset>
      <legend>Zones</legend>
      <p className="hint">
        A zone's kind is recorded on the ledger. Seated zones place each ticket on a seat; unseated
        zones are general admission. Zones can be added while the event is Active, but a zone cannot
        be removed once a ticket has been issued in it.
      </p>
      {zones.length === 0 ? <p>No zones yet.</p> : null}
      {zones.map((zone, index) => {
        const parsed = parsePositions(zone.positions);
        return (
          <div className="group" key={zone.id}>
            <TextField
              label={`Zone ${index + 1} name`}
              value={zone.name}
              onChange={(name) => setZone(index, { ...zone, name })}
            />
            <Field label={`Zone ${index + 1} kind`}>
              {(id) => (
                <select
                  id={id}
                  value={zone.kind}
                  onChange={(event) =>
                    setZone(index, { ...zone, kind: event.target.value as ZoneKind })
                  }
                >
                  <option value="Unseated">Unseated</option>
                  <option value="Seated">Seated</option>
                </select>
              )}
            </Field>
            {zone.kind === "Seated" ? (
              <Field
                label={`Zone ${index + 1} seat positions`}
                hint="One seat designation per line, exactly as it should appear on a ticket. Case and spaces count: C-14 and c14 are different seats."
              >
                {(id) => (
                  <>
                    <textarea
                      id={id}
                      rows={6}
                      value={zone.positions}
                      onChange={(event) =>
                        setZone(index, { ...zone, positions: event.target.value })
                      }
                    />
                    <p className="hint">
                      {parsed.positions.length === 1
                        ? "1 seat position"
                        : `${parsed.positions.length} seat positions`}
                    </p>
                  </>
                )}
              </Field>
            ) : null}
            <button type="button" onClick={() => onChange(zones.filter((_, at) => at !== index))}>
              Remove zone {index + 1}
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() =>
          onChange([...zones, { id: randomId32(), name: "", kind: "Unseated", positions: "" }])
        }
      >
        Add a zone
      </button>
    </fieldset>
  );
}

function capacityOf(limited: boolean, value: string): number | null | "invalid" {
  if (!limited) {
    return null;
  }
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : "invalid";
}

/**
 * Creates an event (`US-A1`): details for its public document (`US-A3`), zones
 * with their kinds (`REQ-ID-7`), canonical seat positions for seated zones, and
 * an optional capacity. Kippu creates it on the ledger with the organiser's
 * authority (`REQ-OA-1`).
 */
export function NewEventWizard() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();
  const capacityId = useId();

  const [step, setStep] = useState<Step>("event.create.details");
  const [details, setDetails] = useState<EventDetailsDraft>(emptyDetails);
  const [zones, setZones] = useState<readonly ZoneDraft[]>([]);
  const [limited, setLimited] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [problems, setProblems] = useState<readonly string[]>([]);
  const [stage, setStage] = useState<Stage | null>(null);
  const [created, setCreated] = useState<{ event: string; cursor: string } | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const bound = capacityOf(limited, capacity);
      let event = created;
      if (event === null) {
        setStage("creating");
        event = await client.events.create.mutate({
          zones: zones.map(({ id, kind }) => ({ id, kind })),
          capacity: bound === "invalid" ? null : bound,
        });
        setCreated(event);
      }
      setStage("describing");
      await client.metadata.events.put.mutate({
        event: event.event,
        document: eventDocument(event.event, details, zones),
      });
      setStage("seating");
      for (const zone of zones) {
        if (zone.kind !== "Seated") {
          continue;
        }
        for (const positions of uploadsOf(parsePositions(zone.positions).positions)) {
          await client.events.zones.addSeatPositions.mutate({
            event: event.event,
            zone: zone.id,
            positions,
          });
        }
      }
      setStage("reading");
      await client.derived.waitFor.query({ cursor: event.cursor, timeout: 10_000 });
      return event;
    },
    onSuccess: async ({ event }) => {
      await queryClient.invalidateQueries({ queryKey: trpc.derived.events.pathKey() });
      navigate("event.create.review", "event.detail", { event });
    },
  });

  function problemsAt(at: Step): readonly string[] {
    switch (at) {
      case "event.create.details":
        return detailsProblems(details);
      case "event.create.zones":
        return zoneProblems(zones);
      case "event.create.capacity":
        return capacityOf(limited, capacity) === "invalid"
          ? ["Write the capacity as a whole number, or leave capacity unlimited."]
          : [];
      case "event.create.review":
        return [...detailsProblems(details), ...zoneProblems(zones)];
    }
  }

  function next() {
    const found = problemsAt(step);
    setProblems(found);
    const following = NEXT[step];
    if (found.length === 0 && following !== null) {
      setStep(following);
    }
  }
  function back() {
    setProblems([]);
    const previous = BACK[step];
    if (previous !== null) {
      setStep(previous);
    }
  }

  const bound = capacityOf(limited, capacity);
  const seated = zones.filter((zone) => zone.kind === "Seated");

  return (
    <Screen id={step}>
      <h1>New event</h1>
      <ol className="steps">
        {STEPS.map((entry) => (
          <li key={entry.step} aria-current={entry.step === step ? "step" : undefined}>
            {entry.title}
          </li>
        ))}
      </ol>
      {created !== null ? (
        <p className="note">
          The event exists on the ledger: its zones and capacity are set. Retrying saves its details
          and seat positions.
        </p>
      ) : null}

      {step === "event.create.details" ? (
        <DetailsStep details={details} onChange={setDetails} />
      ) : null}
      {step === "event.create.zones" ? <ZonesStep zones={zones} onChange={setZones} /> : null}
      {step === "event.create.capacity" ? (
        <fieldset>
          <legend>Capacity</legend>
          <p className="hint">
            Without a capacity, issuance is unbounded. Capacity can later be lowered as far as the
            tickets already issued; raising it needs a validated capacity proof.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={limited}
              onChange={(event) => setLimited(event.target.checked)}
            />
            Limit capacity
          </label>
          {limited ? (
            <div className="field">
              <label htmlFor={capacityId}>Capacity</label>
              <input
                id={capacityId}
                inputMode="numeric"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}
      {step === "event.create.review" ? (
        <div>
          <h2>Review</h2>
          <dl className="facts">
            <dt>Name</dt>
            <dd>{details.name.trim()}</dd>
            <dt>Zones</dt>
            <dd>
              {zones.length === 0
                ? "None"
                : zones
                    .map(
                      (zone, at) =>
                        `${zone.name.trim() || `Zone ${at + 1}`} (${zone.kind}${
                          zone.kind === "Seated"
                            ? `, ${parsePositions(zone.positions).positions.length} seats`
                            : ""
                        })`,
                    )
                    .join(", ")}
            </dd>
            <dt>Capacity</dt>
            <dd>{bound === null ? "Unbounded" : String(bound)}</dd>
          </dl>
          {seated.some((zone) => parsePositions(zone.positions).positions.length === 0) ? (
            <p className="hint">
              A seated zone with no seat positions cannot have tickets issued in it.
            </p>
          ) : null}
        </div>
      ) : null}

      {problems.length > 0 ? (
        <ul role="alert" className="error">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {submit.isPending && stage !== null ? <p role="status">{STAGE_TEXT[stage]}</p> : null}
      {submit.isError ? (
        <p role="alert" className="error">
          {created === null
            ? `The event was not created: ${describeFailure(submit.error)}`
            : `The event was created, but not everything was saved: ${describeFailure(submit.error)}`}
        </p>
      ) : null}

      <div className="actions">
        {BACK[step] !== null && created === null ? (
          <button type="button" onClick={back} disabled={submit.isPending}>
            Back
          </button>
        ) : null}
        {step === "event.create.review" ? (
          <button
            type="button"
            onClick={() => {
              const found = problemsAt("event.create.review");
              setProblems(found);
              if (found.length === 0) {
                submit.mutate();
              }
            }}
            disabled={submit.isPending}
          >
            {created === null ? "Create event" : "Retry"}
          </button>
        ) : (
          <button type="button" onClick={next}>
            Next
          </button>
        )}
      </div>
    </Screen>
  );
}
