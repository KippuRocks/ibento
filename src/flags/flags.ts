import type { AppRouter } from "@kippu/api";
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
    case "unexplained":
      return "Refused by the ledger for another reason";
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
