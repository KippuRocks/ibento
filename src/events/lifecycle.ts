import type { FinishSchedule } from "@kippu/api";

export type { FinishSchedule };

/** An event's ledger status (`SPEC.md` §5.1). */
export type EventStatus = "Active" | "Sealed" | "Cancelled" | "Finished";

/**
 * The permitted status transitions (`REQ-EV-11`): `Active → Sealed`,
 * `Active | Sealed → Finished`, `Active | Sealed → Cancelled`. `Cancelled` and
 * `Finished` are terminal (`AC-A5.6`); the console never offers a transition the
 * ledger would refuse with `ERR-InvalidTransition`.
 */
export function canSeal(status: EventStatus): boolean {
  return status === "Active";
}

export function canCancel(status: EventStatus): boolean {
  return status === "Active" || status === "Sealed";
}

export function canFinish(status: EventStatus): boolean {
  return status === "Active" || status === "Sealed";
}

/** Whether the event's status still allows scheduling, or cancelling a schedule for, `Finished`. */
export function canScheduleFinish(status: EventStatus): boolean {
  return status === "Active" || status === "Sealed";
}

export type FinishAtCheck =
  | { readonly ok: true; readonly at: number }
  | { readonly ok: false; readonly problem: string };

/** A scheduled finish time from a `datetime-local` value: must name a moment still to come. */
export function parseFinishAt(text: string, now: number): FinishAtCheck {
  if (text.trim() === "") {
    return { ok: false, problem: "Choose when the event finishes." };
  }
  const at = new Date(text).getTime();
  if (Number.isNaN(at)) {
    return { ok: false, problem: "Choose when the event finishes." };
  }
  if (at <= now) {
    return { ok: false, problem: "The scheduled finish must be in the future." };
  }
  return { ok: true, at };
}

/** How the console names a schedule's state (`FinishSchedule.status`). */
export function describeScheduleStatus(status: FinishSchedule["status"]): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "running":
      return "Finishing now";
    case "finished":
      return "Finished as scheduled";
    case "refused":
      return "The ledger refused the scheduled finish";
    case "cancelled":
      return "Cancelled";
  }
}
