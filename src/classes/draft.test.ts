import { describe, expect, it } from "vitest";
import {
  checkClass,
  describeRestrictions,
  emptyClass,
  PURCHASED_RESTRICTION_REFUSAL,
} from "./draft";

const EVENT = "e".repeat(64);

describe("a class definition", () => {
  it("AC-B2.1 sets name, quota, attendance policy and, for a granted class, restrictions", () => {
    const check = checkClass(
      EVENT,
      {
        ...emptyClass(),
        name: " Press ",
        provenance: "Granted",
        policy: "Multiple",
        max: "2",
        until: "2026-10-02T02:00",
        cannotResale: true,
        quota: "20",
      },
      null,
    );
    expect(check).toEqual({
      ok: true,
      input: {
        event: EVENT,
        name: "Press",
        description: null,
        provenance: "Granted",
        policy: { kind: "Multiple", max: 2, until: new Date("2026-10-02T02:00").getTime() },
        restrictions: { cannotResale: true, cannotTransfer: false },
        quota: 20,
        price: null,
      },
    });
  });

  it("REQ-TC-3 refuses a Purchased class with any restriction, at definition", () => {
    for (const restriction of [{ cannotResale: true }, { cannotTransfer: true }]) {
      const check = checkClass(
        EVENT,
        { ...emptyClass(), name: "General", provenance: "Purchased", price: "10", ...restriction },
        "COPM/2",
      );
      expect(check).toEqual({ ok: false, problems: [PURCHASED_RESTRICTION_REFUSAL] });
    }
  });

  it("prices a Purchased class in the event's sale asset's minor units", () => {
    const check = checkClass(
      EVENT,
      { ...emptyClass(), name: "General", provenance: "Purchased", price: "45000.50" },
      "COPM/2",
    );
    expect(check.ok && check.input).toMatchObject({
      restrictions: { cannotResale: false, cannotTransfer: false },
      price: 4_500_050,
    });
  });

  it("refuses a Purchased class with no price, or before the event has a sale asset", () => {
    const general = { ...emptyClass(), name: "General", provenance: "Purchased" as const };
    expect(checkClass(EVENT, general, "DUSD/6")).toMatchObject({ ok: false });
    expect(checkClass(EVENT, { ...general, price: "10" }, null)).toEqual({
      ok: false,
      problems: [expect.stringMatching(/sale asset/)],
    });
  });

  it("gives a Granted class no price, whatever the form holds", () => {
    const check = checkClass(EVENT, { ...emptyClass(), name: "Guests", price: "10" }, "COPM/2");
    expect(check.ok && check.input.price).toBeNull();
  });

  it("carries cannotResale with cannotTransfer (REQ-TK-2)", () => {
    const check = checkClass(EVENT, { ...emptyClass(), name: "Staff", cannotTransfer: true }, null);
    expect(check.ok && check.input.restrictions).toEqual({
      cannotResale: true,
      cannotTransfer: true,
    });
    expect(describeRestrictions({ cannotResale: true, cannotTransfer: true })).toBe(
      "Cannot be transferred or resold",
    );
  });

  it("leaves quota and until unbounded when empty", () => {
    const check = checkClass(
      EVENT,
      { ...emptyClass(), name: "Artists", policy: "Unlimited", max: "x" },
      null,
    );
    expect(check.ok && check.input).toMatchObject({
      policy: { kind: "Unlimited", until: null },
      quota: null,
    });
  });

  it("names what is missing or malformed", () => {
    const check = checkClass(EVENT, { ...emptyClass(), policy: "Multiple", quota: "ten" }, null);
    expect(check.ok ? [] : check.problems).toHaveLength(3);
  });
});
