import type { AppRouter } from "@kippu/api";
import type { inferRouterOutputs } from "@trpc/server";

type Outputs = inferRouterOutputs<AppRouter>;
export type OperatorAccount = Outputs["operators"]["list"][number];
export type OperatorGrant = Outputs["operators"]["grants"]["list"][number];

/** The longest gate label kippu-api accepts, and how many gates one grant may name. */
export const MAX_GATE_LENGTH = 100;
export const MAX_GATES = 100;

export type GatesCheck =
  | { readonly ok: true; readonly gates: readonly string[] }
  | { readonly ok: false; readonly problem: string };

/**
 * Gate labels, one per line. A gate is the organiser's own label, such as
 * `North door`, and Iriguchi must name it exactly: surrounding spaces are
 * removed, as kippu-api removes them, and a label written twice is one gate.
 */
export function parseGates(text: string): GatesCheck {
  const gates = [
    ...new Set(
      text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== ""),
    ),
  ];
  if (gates.length === 0) {
    return { ok: false, problem: "Name at least one gate." };
  }
  if (gates.length > MAX_GATES) {
    return { ok: false, problem: `A grant names at most ${MAX_GATES} gates.` };
  }
  const long = gates.find((gate) => gate.length > MAX_GATE_LENGTH);
  if (long !== undefined) {
    return { ok: false, problem: `A gate label is at most ${MAX_GATE_LENGTH} characters.` };
  }
  if (gates.some((gate) => !gate.isWellFormed())) {
    return { ok: false, problem: "A gate label is not well-formed text." };
  }
  return { ok: true, gates };
}

export type WindowCheck =
  | { readonly ok: true; readonly from: number; readonly until: number }
  | { readonly ok: false; readonly problem: string };

/** A grant's window from two `datetime-local` values: from, inclusive, until strictly before `until`. */
export function parseWindow(from: string, until: string): WindowCheck {
  const start = new Date(from).getTime();
  const end = new Date(until).getTime();
  if (from === "" || Number.isNaN(start)) {
    return { ok: false, problem: "Choose when the grant starts." };
  }
  if (until === "" || Number.isNaN(end)) {
    return { ok: false, problem: "Choose when the grant ends." };
  }
  if (end <= start) {
    return { ok: false, problem: "The grant must end after it starts." };
  }
  return { ok: true, from: start, until: end };
}

export type GrantStatus = "revoked" | "scheduled" | "active" | "ended";

/** Where a grant stands at `now`, by the organiser's clock; kippu-api's check decides at the gate. */
export function grantStatus(grant: OperatorGrant, now: number): GrantStatus {
  if (grant.revokedAt !== null) {
    return "revoked";
  }
  if (now < grant.from) {
    return "scheduled";
  }
  return now < grant.until ? "active" : "ended";
}

export function describeGrantStatus(status: GrantStatus): string {
  switch (status) {
    case "revoked":
      return "Revoked";
    case "scheduled":
      return "Not started";
    case "active":
      return "Active";
    case "ended":
      return "Ended";
  }
}
