import { describe, expect, it } from "vitest";
import {
  detailsOf,
  detailsProblems,
  EVENT_SCHEMA_ID,
  emptyDetails,
  eventDocument,
  zoneNameOf,
} from "./document";

const EVENT = "a".repeat(64);
const STALLS = "b".repeat(64);
const STANDING = "c".repeat(64);

describe("the event document", () => {
  it("declares the event schema and the event, and leaves empty fields out", () => {
    expect(eventDocument(EVENT, { ...emptyDetails(), name: " Gala " }, [])).toEqual({
      $schema: EVENT_SCHEMA_ID,
      eventId: EVENT,
      name: "Gala",
    });
  });

  it("carries the venue, schedule, organiser and zone names the organiser wrote", () => {
    const document = eventDocument(
      EVENT,
      {
        ...emptyDetails(),
        name: "Gala",
        description: "An evening.",
        tradingName: "Kippu Events Ltd",
        venueName: "Teatro Real",
        locality: "Madrid",
        country: "ES",
        timeZone: "Europe/Madrid",
        sessions: [{ name: "", startsAt: "2026-10-01T20:00", endsAt: "" }],
      },
      [
        { id: STALLS, name: "Stalls" },
        { id: STANDING, name: " " },
      ],
    );
    expect(document).toEqual({
      $schema: EVENT_SCHEMA_ID,
      eventId: EVENT,
      name: "Gala",
      description: "An evening.",
      organiser: { tradingName: "Kippu Events Ltd" },
      venue: { name: "Teatro Real", address: { locality: "Madrid", country: "ES" } },
      schedule: {
        timeZone: "Europe/Madrid",
        sessions: [{ startsAt: new Date("2026-10-01T20:00").toISOString() }],
      },
      zones: { [STALLS]: { name: "Stalls" } },
    });
  });

  it("names what would not conform to the schema", () => {
    expect(detailsProblems(emptyDetails())).toEqual(["Give the event a name."]);
    expect(
      detailsProblems({
        ...emptyDetails(),
        name: "Gala",
        locality: "Madrid",
        country: "Spain",
        sessions: [{ name: "", startsAt: "", endsAt: "" }],
      }),
    ).toHaveLength(3);
  });
});

describe("editing an event document", () => {
  const base = {
    $schema: EVENT_SCHEMA_ID,
    eventId: EVENT,
    name: "Gala",
    description: "Old copy.",
    venue: { name: "Teatro Real", address: { country: "ES" } },
    schedule: { sessions: [{ startsAt: "2026-10-01T18:00:00.000Z" }] },
    imagery: [{ url: "https://meta.kippu.rocks/v0/images/a/1.png", mediaType: "image/png" }],
    zones: { [STALLS]: { name: "Stalls", description: "Rows A to F" } },
    seatMaps: [{ url: "https://meta.kippu.rocks/v0/images/a/map.png" }],
  };

  it("fills the form from the document, and writes the same document back unchanged", () => {
    const details = detailsOf(base);
    expect(details).toMatchObject({
      name: "Gala",
      description: "Old copy.",
      venueName: "Teatro Real",
      country: "ES",
      imagery: [{ url: base.imagery[0]?.url, alt: "", mediaType: "image/png" }],
    });
    expect(
      eventDocument(EVENT, details, [{ id: STALLS, name: zoneNameOf(base, STALLS) }], base),
    ).toEqual(base);
  });

  it("changes what the form edits and keeps what it does not", () => {
    const details = { ...detailsOf(base), description: "New copy.", imagery: [] };
    const document = eventDocument(EVENT, details, [{ id: STALLS, name: "Front stalls" }], base);
    expect(document.description).toBe("New copy.");
    expect(document.imagery).toBeUndefined();
    expect(document.seatMaps).toEqual(base.seatMaps);
    expect(document.zones).toEqual({
      [STALLS]: { name: "Front stalls", description: "Rows A to F" },
    });
  });

  it("removes a zone's name when it is left empty", () => {
    const document = eventDocument(EVENT, detailsOf(base), [{ id: STALLS, name: "" }], base);
    expect(document.zones).toBeUndefined();
  });

  it("starts from an empty form for an event with no document", () => {
    expect(detailsOf(null)).toEqual(emptyDetails());
  });
});
