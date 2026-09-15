import { describe, expect, it } from "vitest";
import { grantStatus, type OperatorGrant, parseGates, parseWindow } from "./grants";

const grant: OperatorGrant = {
  id: "00000000-0000-4000-8000-000000000001",
  operator: "00000000-0000-4000-8000-000000000002",
  event: "e".repeat(64),
  gates: ["North door"],
  from: 1_000,
  until: 2_000,
  createdAt: "2026-09-15T10:00:00.000Z",
  revokedAt: null,
};

describe("grants", () => {
  it("reads one gate per line, trimmed, each once", () => {
    expect(parseGates(" North door \n\nSouth door\nNorth door\r\n")).toEqual({
      ok: true,
      gates: ["North door", "South door"],
    });
  });

  it("refuses no gates, and labels kippu-api would refuse", () => {
    expect(parseGates("\n  \n")).toMatchObject({ ok: false });
    expect(parseGates("x".repeat(101))).toMatchObject({ ok: false });
    expect(parseGates(Array.from({ length: 101 }, (_, n) => `Gate ${n}`).join("\n"))).toMatchObject(
      {
        ok: false,
      },
    );
  });

  it("reads a window that ends after it starts", () => {
    expect(parseWindow("2026-10-01T18:00", "2026-10-01T23:30")).toEqual({
      ok: true,
      from: new Date("2026-10-01T18:00").getTime(),
      until: new Date("2026-10-01T23:30").getTime(),
    });
    expect(parseWindow("2026-10-01T18:00", "2026-10-01T18:00")).toMatchObject({ ok: false });
    expect(parseWindow("", "2026-10-01T18:00")).toMatchObject({ ok: false });
  });

  it("places a grant in its window: from inclusive, until exclusive, revoked above all", () => {
    expect(grantStatus(grant, 999)).toBe("scheduled");
    expect(grantStatus(grant, 1_000)).toBe("active");
    expect(grantStatus(grant, 2_000)).toBe("ended");
    expect(grantStatus({ ...grant, revokedAt: "2026-09-15T10:05:00.000Z" }, 1_500)).toBe("revoked");
  });
});
