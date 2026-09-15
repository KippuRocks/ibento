import { describe, expect, it } from "vitest";
import { parseWindowSeconds, secondsOf } from "./window";

const bounds = { minimumMs: 10_000, maximumMs: 300_000 };

describe("the pass window", () => {
  it("reads whole seconds as milliseconds, inside the bounds kippu-api reports", () => {
    expect(parseWindowSeconds("90", bounds)).toEqual({ ok: true, windowMs: 90_000 });
    expect(parseWindowSeconds(" 10 ", bounds)).toEqual({ ok: true, windowMs: 10_000 });
    expect(parseWindowSeconds("300", bounds)).toEqual({ ok: true, windowMs: 300_000 });
  });

  it("refuses a window outside the bounds, naming them", () => {
    expect(parseWindowSeconds("9", bounds)).toEqual({
      ok: false,
      problem: "The pass window is between 10 and 300 seconds.",
    });
    expect(parseWindowSeconds("301", bounds)).toMatchObject({ ok: false });
    expect(parseWindowSeconds("600", { minimumMs: 10_000, maximumMs: 900_000 })).toEqual({
      ok: true,
      windowMs: 600_000,
    });
  });

  it("refuses anything but a whole number of seconds", () => {
    for (const text of ["", "1.5", "-20", "1e2", "sixty"]) {
      expect(parseWindowSeconds(text, bounds), text).toMatchObject({ ok: false });
    }
  });

  it("shows milliseconds as seconds", () => {
    expect(secondsOf(60_000)).toBe("60");
    expect(secondsOf(1_500)).toBe("1.500");
  });
});
