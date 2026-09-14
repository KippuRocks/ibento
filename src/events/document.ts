import type { AppRouter } from "@kippu/api";
import type { inferRouterInputs } from "@trpc/server";

/** An event's public metadata document (`F-026`, contract `C6`). */
export type EventDocument = inferRouterInputs<AppRouter>["metadata"]["events"]["put"]["document"];

/** The schema every event document Ibento writes declares (`REQ-MD-4`). */
export const EVENT_SCHEMA_ID = "https://meta.kippu.rocks/v0/schemas/event/1.0.json";

export interface SessionDraft {
  readonly name: string;
  /** As a `datetime-local` input holds it: the organiser's local time. */
  readonly startsAt: string;
  readonly endsAt: string;
}

/** What the organiser writes about an event, as the form holds it. Nothing here is a ledger fact. */
export interface EventDetailsDraft {
  readonly name: string;
  readonly description: string;
  readonly tradingName: string;
  readonly venueName: string;
  readonly streetAddress: string;
  readonly locality: string;
  readonly region: string;
  readonly postalCode: string;
  readonly country: string;
  readonly timeZone: string;
  readonly sessions: readonly SessionDraft[];
}

export interface ZoneName {
  readonly id: string;
  readonly name: string;
}

export function emptyDetails(): EventDetailsDraft {
  return {
    name: "",
    description: "",
    tradingName: "",
    venueName: "",
    streetAddress: "",
    locality: "",
    region: "",
    postalCode: "",
    country: "",
    timeZone: "",
    sessions: [],
  };
}

/** A local date and time as RFC 3339 with an offset; `null` when it is not one. */
export function rfc3339(local: string): string | null {
  if (local === "") {
    return null;
  }
  const time = new Date(local);
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
}

/** What stops the details from making a document that conforms to the event schema. */
export function detailsProblems(details: EventDetailsDraft): readonly string[] {
  const problems: string[] = [];
  if (details.name.trim() === "") {
    problems.push("Give the event a name.");
  }
  const address = [details.streetAddress, details.locality, details.region, details.postalCode];
  if (
    details.venueName.trim() === "" &&
    [...address, details.country].some((part) => part.trim() !== "")
  ) {
    problems.push("Give the venue a name, or leave its address empty.");
  }
  if (details.country.trim() !== "" && !/^[A-Z]{2}$/.test(details.country.trim())) {
    problems.push("Write the country as a two-letter code, such as ES or GB.");
  }
  details.sessions.forEach((session, index) => {
    if (rfc3339(session.startsAt) === null) {
      problems.push(`Session ${index + 1} needs a start.`);
    }
    if (session.endsAt !== "" && rfc3339(session.endsAt) === null) {
      problems.push(`Session ${index + 1} has an end that is not a date and time.`);
    }
  });
  return problems;
}

/** A text field, trimmed; absent when empty. */
function text<K extends string>(key: K, value: string): { [P in K]?: string } {
  const trimmed = value.trim();
  return (trimmed === "" ? {} : { [key]: trimmed }) as { [P in K]?: string };
}

/**
 * The event document the details describe, declaring the event schema, with
 * `eventId` the event's. Empty fields are left out. Zones without a name are
 * left out of `zones`: a zone's identity and kind are ledger facts, its name is
 * not.
 */
export function eventDocument(
  eventId: string,
  details: EventDetailsDraft,
  zones: readonly ZoneName[],
): EventDocument {
  const address = {
    ...text("streetAddress", details.streetAddress),
    ...text("locality", details.locality),
    ...text("region", details.region),
    ...text("postalCode", details.postalCode),
    ...text("country", details.country),
  };
  const namedZones = Object.fromEntries(
    zones
      .filter((zone) => zone.name.trim() !== "")
      .map((zone) => [zone.id, { name: zone.name.trim() }]),
  );
  const sessions = details.sessions.map((session) => ({
    ...text("name", session.name),
    startsAt: rfc3339(session.startsAt) ?? "",
    ...(rfc3339(session.endsAt) === null ? {} : { endsAt: rfc3339(session.endsAt) ?? "" }),
  }));
  return {
    $schema: EVENT_SCHEMA_ID,
    eventId,
    name: details.name.trim(),
    ...text("description", details.description),
    ...(details.tradingName.trim() === ""
      ? {}
      : { organiser: { tradingName: details.tradingName.trim() } }),
    ...(details.venueName.trim() === ""
      ? {}
      : {
          venue: {
            name: details.venueName.trim(),
            ...(Object.keys(address).length === 0 ? {} : { address }),
          },
        }),
    ...(sessions.length === 0
      ? {}
      : { schedule: { ...text("timeZone", details.timeZone), sessions } }),
    ...(Object.keys(namedZones).length === 0 ? {} : { zones: namedZones }),
  };
}
