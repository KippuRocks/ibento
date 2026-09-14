import { describe, expect, it } from "vitest";
import { detailsProblems, EVENT_SCHEMA_ID, emptyDetails, eventDocument } from "./document";

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
