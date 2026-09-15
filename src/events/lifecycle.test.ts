import { describe, expect, it } from "vitest";
import {
  canCancel,
  canFinish,
  canScheduleFinish,
  canSeal,
  describeScheduleStatus,
  parseFinishAt,
} from "./lifecycle";

describe("REQ-EV-11: permitted status transitions", () => {
  it("seals only an Active event", () => {
    expect(canSeal("Active")).toBe(true);
    expect(canSeal("Sealed")).toBe(false);
    expect(canSeal("Cancelled")).toBe(false);
    expect(canSeal("Finished")).toBe(false);
  });

  it("cancels an Active or Sealed event, never a terminal one", () => {
    expect(canCancel("Active")).toBe(true);
    expect(canCancel("Sealed")).toBe(true);
    expect(canCancel("Cancelled")).toBe(false);
    expect(canCancel("Finished")).toBe(false);
  });

  it("finishes an Active or Sealed event, never a terminal one", () => {
    expect(canFinish("Active")).toBe(true);
    expect(canFinish("Sealed")).toBe(true);
    expect(canFinish("Cancelled")).toBe(false);
    expect(canFinish("Finished")).toBe(false);
  });

  it("schedules a finish only while the event is still Active or Sealed", () => {
    expect(canScheduleFinish("Active")).toBe(true);
    expect(canScheduleFinish("Sealed")).toBe(true);
    expect(canScheduleFinish("Cancelled")).toBe(false);
    expect(canScheduleFinish("Finished")).toBe(false);
  });
});

describe("a scheduled finish time", () => {
  const now = Date.parse("2026-09-15T12:00:00.000Z");

  it("reads a datetime-local value in the future", () => {
    expect(parseFinishAt("2026-09-16T12:00", now)).toEqual({
      ok: true,
      at: Date.parse("2026-09-16T12:00:00.000"),
    });
  });

  it("refuses an empty or unparseable value", () => {
    expect(parseFinishAt("", now)).toEqual({
      ok: false,
      problem: "Choose when the event finishes.",
    });
    expect(parseFinishAt("not a date", now)).toMatchObject({ ok: false });
  });

  it("refuses a moment that is not in the future", () => {
    expect(parseFinishAt("2026-09-14T12:00", now)).toEqual({
      ok: false,
      problem: "The scheduled finish must be in the future.",
    });
  });
});

describe("a schedule's status", () => {
  it("is named in plain terms", () => {
    expect(describeScheduleStatus("scheduled")).toBe("Scheduled");
    expect(describeScheduleStatus("running")).toBe("Finishing now");
    expect(describeScheduleStatus("finished")).toBe("Finished as scheduled");
    expect(describeScheduleStatus("refused")).toBe("The ledger refused the scheduled finish");
    expect(describeScheduleStatus("cancelled")).toBe("Cancelled");
  });
});
