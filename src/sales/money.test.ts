import { describe, expect, it } from "vitest";
import { formatMinor, parsePrice } from "./money";

describe("prices", () => {
  it("reads major units into the asset's minor units exactly", () => {
    expect(parsePrice("45000.50", "COPM/2")).toEqual({ ok: true, minor: 4_500_050 });
    expect(parsePrice("45000.5", "COPM/2")).toEqual({ ok: true, minor: 4_500_050 });
    expect(parsePrice("12", "COPM/2")).toEqual({ ok: true, minor: 1_200 });
    expect(parsePrice("0.000001", "DUSD/6")).toEqual({ ok: true, minor: 1 });
    expect(parsePrice("19.99", "DUSD/6")).toEqual({ ok: true, minor: 19_990_000 });
  });

  it("is exact where floating point is not", () => {
    // 0.1 + 0.2 and 1.005 * 100 are not what they look like in floating point.
    expect(parsePrice("0.30", "COPM/2")).toEqual({ ok: true, minor: 30 });
    expect(parsePrice("1.005", "DUSD/6")).toEqual({ ok: true, minor: 1_005_000 });
    expect(parsePrice("90071992547409.91", "COPM/2")).toEqual({
      ok: true,
      minor: 9_007_199_254_740_991,
    });
  });

  it("refuses more decimals than the asset has", () => {
    expect(parsePrice("1.001", "COPM/2")).toMatchObject({
      ok: false,
      problem: expect.stringMatching(/2 decimal places/),
    });
    expect(parsePrice("1.0000001", "DUSD/6")).toMatchObject({ ok: false });
  });

  it("refuses zero, negatives, separators, and amounts beyond a safe integer", () => {
    for (const text of ["0", "0.00", "-1", "1,000", "1 000", "", "1e3", "90071992547409.92"]) {
      expect(parsePrice(text, "COPM/2"), text).toMatchObject({ ok: false });
    }
  });

  it("shows minor units in major units with the asset's precision", () => {
    expect(formatMinor(4_500_050, "COPM/2")).toBe("45000.50 COPM");
    expect(formatMinor(5, "COPM/2")).toBe("0.05 COPM");
    expect(formatMinor(19_990_000, "DUSD/6")).toBe("19.990000 DUSD");
    expect(formatMinor(1, "DUSD/6", false)).toBe("0.000001");
    expect(formatMinor(9_007_199_254_740_991, "COPM/2")).toBe("90071992547409.91 COPM");
  });
});
