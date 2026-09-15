import { describe, expect, it } from "vitest";
import { describeCause, describeDrift, describeOutcome, explainCause } from "./flags";

describe("admission flags", () => {
  it("names every cause", () => {
    expect(describeCause("same-pass-at-two-gates")).toBe("Same pass admitted at two gates");
    expect(describeCause("transfer-before-recording")).toMatch(/transferred between/);
    expect(describeCause("gate-clock-outside-tolerance")).toBe("Gate clock outside tolerance");
    expect(describeCause("unexplained")).toMatch(/another reason/);
  });

  it("explains what each cause means for the organiser", () => {
    expect(explainCause("same-pass-at-two-gates")).toMatch(
      /two gates.*recorded the attendance once/,
    );
    expect(explainCause("transfer-before-recording")).toMatch(/no longer held the ticket/);
    expect(explainCause("gate-clock-outside-tolerance")).toMatch(/more than 10 seconds/);
    expect(explainCause("unexplained")).toMatch(/refusal code says why/);
  });

  it("shows clock drift signed, in seconds to a tenth", () => {
    expect(describeDrift(30_000)).toBe("+30.0 s");
    expect(describeDrift(-15_040)).toBe("−15.0 s");
    expect(describeDrift(10_050)).toBe("+10.1 s");
    expect(describeDrift(0)).toBe("0.0 s");
  });

  it("describes other reports for the same pass", () => {
    expect(describeOutcome("settled")).toBe("admitted, recorded by the ledger");
    expect(describeOutcome("refused-at-gate")).toBe("refused at the gate");
  });
});
