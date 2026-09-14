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

/** An image of the event, uploaded to the metadata origin (`T-026-06`). */
export interface ImageDraft {
  readonly url: string;
  readonly alt: string;
  readonly mediaType: string | null;
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
  /** In the order a client should prefer them. */
  readonly imagery: readonly ImageDraft[];
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
    imagery: [],
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

type Json = EventDocument[string];
type JsonObject = { readonly [field: string]: Json };

function objectAt(value: Json | undefined): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function textAt(value: Json | undefined): string {
  return typeof value === "string" ? value : "";
}

/** The fields of the event schema the details form writes; every other field is kept as it was. */
const MANAGED_FIELDS = [
  "$schema",
  "eventId",
  "name",
  "description",
  "organiser",
  "venue",
  "schedule",
  "imagery",
] as const;

/**
 * The event document the details describe, declaring the event schema, with
 * `eventId` the event's. Empty fields are left out.
 *
 * Given the document the event already has, fields the form does not edit —
 * seat map references, zone descriptions — are kept. A zone's name is set for
 * each zone named, and removed when left empty: a zone's identity and kind are
 * ledger facts, its name is not.
 */
export function eventDocument(
  eventId: string,
  details: EventDetailsDraft,
  zones: readonly ZoneName[],
  base: EventDocument | null = null,
): EventDocument {
  const kept: Record<string, Json> = { ...base };
  for (const field of MANAGED_FIELDS) {
    delete kept[field];
  }
  const address = {
    ...text("streetAddress", details.streetAddress),
    ...text("locality", details.locality),
    ...text("region", details.region),
    ...text("postalCode", details.postalCode),
    ...text("country", details.country),
  };
  const zoneEntries: Record<string, Json> = { ...objectAt(base?.zones) };
  for (const zone of zones) {
    const name = zone.name.trim();
    if (name === "") {
      delete zoneEntries[zone.id];
    } else {
      zoneEntries[zone.id] = { ...objectAt(zoneEntries[zone.id]), name };
    }
  }
  delete kept.zones;
  const sessions = details.sessions.map((session) => ({
    ...text("name", session.name),
    startsAt: rfc3339(session.startsAt) ?? "",
    ...(rfc3339(session.endsAt) === null ? {} : { endsAt: rfc3339(session.endsAt) ?? "" }),
  }));
  const imagery = details.imagery.map((image) => ({
    url: image.url,
    ...text("alt", image.alt),
    ...(image.mediaType === null ? {} : { mediaType: image.mediaType }),
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
    ...(imagery.length === 0 ? {} : { imagery }),
    ...kept,
    ...(Object.keys(zoneEntries).length === 0 ? {} : { zones: zoneEntries }),
  };
}

/** A time as a `datetime-local` input holds it, in this browser's time zone. */
export function localDateTime(iso: string): string {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) {
    return "";
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(
    time.getHours(),
  )}:${pad(time.getMinutes())}`;
}

/** The details form's fields, filled from the document an event has; empty when it has none. */
export function detailsOf(document: EventDocument | null): EventDetailsDraft {
  if (document === null) {
    return emptyDetails();
  }
  const venue = objectAt(document.venue);
  const address = objectAt(venue?.address);
  const schedule = objectAt(document.schedule);
  const sessions = Array.isArray(schedule?.sessions) ? schedule.sessions : [];
  const imagery = Array.isArray(document.imagery) ? document.imagery : [];
  return {
    name: textAt(document.name),
    description: textAt(document.description),
    tradingName: textAt(objectAt(document.organiser)?.tradingName),
    venueName: textAt(venue?.name),
    streetAddress: textAt(address?.streetAddress),
    locality: textAt(address?.locality),
    region: textAt(address?.region),
    postalCode: textAt(address?.postalCode),
    country: textAt(address?.country),
    timeZone: textAt(schedule?.timeZone),
    sessions: sessions.map((entry) => {
      const session = objectAt(entry);
      return {
        name: textAt(session?.name),
        startsAt: localDateTime(textAt(session?.startsAt)),
        endsAt: localDateTime(textAt(session?.endsAt)),
      };
    }),
    imagery: imagery.flatMap((entry) => {
      const image = objectAt(entry);
      const url = textAt(image?.url);
      if (url === "") {
        return [];
      }
      const mediaType = textAt(image?.mediaType);
      return [{ url, alt: textAt(image?.alt), mediaType: mediaType === "" ? null : mediaType }];
    }),
  };
}

/** The name the document gives a zone; empty when it gives none. */
export function zoneNameOf(document: EventDocument | null, zone: string): string {
  return textAt(objectAt(objectAt(document?.zones)?.[zone])?.name);
}
