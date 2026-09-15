import type { AppRouter } from "@kippu/api";
import type { inferRouterOutputs } from "@trpc/server";

export type CapacityProofRequest =
  inferRouterOutputs<AppRouter>["events"]["capacityProofs"]["list"][number];

/** The artefact types a capacity proof may be (`REQ-EV-6`): documents and scans, no active content. */
export const PROOF_ARTEFACT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export type ProofArtefactType = (typeof PROOF_ARTEFACT_TYPES)[number];

/** The largest artefact kippu-api accepts: 2 MiB. */
export const MAX_PROOF_ARTEFACT_BYTES = 2 * 1024 * 1024;

export function isProofArtefactType(type: string): type is ProofArtefactType {
  return (PROOF_ARTEFACT_TYPES as readonly string[]).includes(type);
}

/** Why a file cannot be uploaded as a capacity proof artefact; `null` when it can. */
export function proofArtefactProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!isProofArtefactType(file.type)) {
    return "Choose a PDF, JPEG or PNG file.";
  }
  if (file.size > MAX_PROOF_ARTEFACT_BYTES) {
    return "Choose a file of at most 2 MiB.";
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  return null;
}

/**
 * Whether a requested capacity is an increase (`REQ-EV-5`, `REQ-EV-7`), mirroring
 * kippu-api's own rule: from no bound, any bound at all is an increase, since
 * removing a bound is one (`REQ-EV-7`) and there is no current figure to compare
 * a lower one against.
 */
export function isCapacityIncrease(current: number | null, requested: number | null): boolean {
  return current === null ? requested !== null : requested === null || requested > current;
}

export function describeProofStatus(status: CapacityProofRequest["status"]): string {
  switch (status) {
    case "pending":
      return "Waiting for review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
  }
}
