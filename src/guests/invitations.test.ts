import { describe, expect, it } from "vitest";
import {
  type Invitation,
  invitationLink,
  isSaifuLinkBase,
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
  it("links to Saifu's invitation screen, with the token in the fragment", () => {
    expect(invitationLink("tok_en-1")).toBe("https://saifu.kippu.example/invitations#tok_en-1");
    expect(invitationLink("t", "https://saifu.example")).toBe(
      "https://saifu.example/invitations#t",
    );
    expect(PLACEHOLDER_SAIFU_LINK_BASE).toBe("https://saifu.kippu.example");
  });

  it("refuses a Saifu link base that is not an https origin with no path", () => {
    for (const base of [
      "https://saifu.example/",
      "https://saifu.example/app",
      "http://saifu.example",
      "saifu",
    ]) {
      expect(isSaifuLinkBase(base), base).toBe(false);
      expect(() => invitationLink("t", base)).toThrow(/https origin/);
    }
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
