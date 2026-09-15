import { describe, expect, it } from "vitest";
import {
  type Invitation,
  invitationLink,
  PLACEHOLDER_SAIFU_LINK_BASE,
  seatConflict,
} from "./invitations";

const STALLS = "a".repeat(64);
const BALCONY = "b".repeat(64);

function invitation(overrides: Partial<Invitation>): Invitation {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    event: "e".repeat(64),
    class: "c".repeat(64),
    zone: STALLS,
    placement: { kind: "Seated", position: "A-1" },
    guest: null,
    status: "open",
    holder: null,
    ticket: null,
    createdAt: "2026-09-15T10:00:00.000Z",
    redeemedAt: null,
    ...overrides,
  };
}

describe("invitations", () => {
  it("links to the configured Saifu base, or the placeholder", () => {
    expect(invitationLink("tok_en-1")).toBe(`${PLACEHOLDER_SAIFU_LINK_BASE}tok_en-1`);
    expect(invitationLink("t", "https://saifu.example/i#")).toBe("https://saifu.example/i#t");
  });

  it("warns of a seat that already has an open invitation", () => {
    expect(seatConflict([invitation({})], STALLS, "A-1")).toBe("open");
    expect(seatConflict([invitation({ status: "redeeming" })], STALLS, "A-1")).toBe("open");
  });

  it("warns of a seat already issued through an invitation", () => {
    expect(seatConflict([invitation({}), invitation({ status: "redeemed" })], STALLS, "A-1")).toBe(
      "redeemed",
    );
  });

  it("compares designations as kippu-api stores them, in NFC", () => {
    const composed = invitation({ placement: { kind: "Seated", position: "Fila-Ñ" } });
    expect(seatConflict([composed], STALLS, "Fila-Ñ")).toBe("open");
  });

  it("ignores other seats, other zones, general admission and failed issuance", () => {
    const invitations = [
      invitation({ placement: { kind: "Seated", position: "A-2" } }),
      invitation({ zone: BALCONY }),
      invitation({ placement: { kind: "Unseated" } }),
      invitation({ status: "failed" }),
    ];
    expect(seatConflict(invitations, STALLS, "A-1")).toBeNull();
  });
});
