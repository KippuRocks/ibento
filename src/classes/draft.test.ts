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
    const check = checkClass(EVENT, {
      ...emptyClass(),
      name: " Press ",
      provenance: "Granted",
      policy: "Multiple",
      max: "2",
      until: "2026-10-02T02:00",
      cannotResale: true,
      quota: "20",
    });
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
      },
    });
  });

  it("REQ-TC-3 refuses a Purchased class with any restriction, at definition", () => {
    for (const restriction of [{ cannotResale: true }, { cannotTransfer: true }]) {
      const check = checkClass(EVENT, {
        ...emptyClass(),
        name: "General",
        provenance: "Purchased",
        ...restriction,
      });
      expect(check).toEqual({ ok: false, problems: [PURCHASED_RESTRICTION_REFUSAL] });
    }
  });

  it("accepts a Purchased class with no restriction", () => {
    const check = checkClass(EVENT, { ...emptyClass(), name: "General", provenance: "Purchased" });
    expect(check.ok && check.input.restrictions).toEqual({
      cannotResale: false,
      cannotTransfer: false,
    });
  });

  it("carries cannotResale with cannotTransfer (REQ-TK-2)", () => {
    const check = checkClass(EVENT, { ...emptyClass(), name: "Staff", cannotTransfer: true });
    expect(check.ok && check.input.restrictions).toEqual({
      cannotResale: true,
      cannotTransfer: true,
    });
    expect(describeRestrictions({ cannotResale: true, cannotTransfer: true })).toBe(
      "Cannot be transferred or resold",
    );
  });

  it("leaves quota and until unbounded when empty, and ignores them for a Single policy", () => {
    const check = checkClass(EVENT, {
      ...emptyClass(),
      name: "Artists",
      policy: "Unlimited",
      max: "x",
    });
    expect(check.ok && check.input).toMatchObject({
      policy: { kind: "Unlimited", until: null },
      quota: null,
    });
  });

  it("names what is missing or malformed", () => {
    const check = checkClass(EVENT, { ...emptyClass(), policy: "Multiple", quota: "ten" });
    expect(check.ok ? [] : check.problems).toHaveLength(3);
  });
});
