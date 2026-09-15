import type { AppRouter } from "@kippurocks/api";
import type { inferRouterOutputs } from "@trpc/server";

export type AdmissionFlagsRead = inferRouterOutputs<AppRouter>["derived"]["admissionFlags"]["list"];
export type AdmissionFlag = AdmissionFlagsRead["flags"][number];
export type AdmissionFlagCause = AdmissionFlag["cause"];

/** How the console names each cause of `REQ-OP-3`, and the one kippu-api adds for the rest. */
export function describeCause(cause: AdmissionFlagCause): string {
  switch (cause) {
    case "same-pass-at-two-gates":
      return "Same pass admitted at two gates";
    case "transfer-before-recording":
      return "Ticket transferred between the gate's verdict and the ledger's recording";
    case "gate-clock-outside-tolerance":
      return "Gate clock outside tolerance";
    case "not-recorded":
      return "Admission never reached the ledger";
    case "unexplained":
      return "Refused by the ledger for another reason";
  }
}

/**
 * What a cause means for the organiser, in plain terms (`REQ-OP-3`). A flag is
 * evidence of what happened at the gate; nothing can be done to a ticket from it.
 */
export function explainCause(cause: AdmissionFlagCause): string {
  switch (cause) {
    case "same-pass-at-two-gates":
      return "One pass was admitted at two gates. The ledger recorded the attendance once and refused the other, so one of those admissions has no recorded attendance: the pass may have been copied or shared.";
    case "transfer-before-recording":
      return "The ticket changed hands after the gate admitted its pass and before the ledger recorded the attendance, so the ledger refused the pass: the person admitted no longer held the ticket.";
    case "gate-clock-outside-tolerance":
      return "The gate's clock was more than 10 seconds from Kippu's. A gate judges whether a pass has expired by its own clock, so its verdicts may be wrong until the device's time is corrected.";
    case "not-recorded":
      return "The gate reported this admission as submitted, but its window to be recorded has passed and the ledger holds no record of it: the submission itself may have failed.";
    case "unexplained":
      return "The ledger refused this admission for a reason none of the other causes explains. Its refusal code says why.";
  }
}

/** A gate's clock drift from Kippu's, signed, in seconds: `+30.0 s` means the gate was ahead. */
export function describeDrift(ms: number): string {
  const tenths = Math.round(Math.abs(ms) / 100);
  const sign = ms > 0 ? "+" : ms < 0 ? "−" : "";
  return `${sign}${Math.floor(tenths / 10)}.${tenths % 10} s`;
}

export function describeOutcome(outcome: AdmissionFlag["otherReports"][number]["outcome"]): string {
  switch (outcome) {
    case "settled":
      return "admitted, recorded by the ledger";
    case "rejected":
      return "admitted, refused by the ledger";
    case "failed":
      return "admitted, submission failed";
    case "refused-at-gate":
      return "refused at the gate";
  }
}
