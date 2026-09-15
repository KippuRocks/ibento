import { describe, expect, it } from "vitest";
import {
  describeProofStatus,
  isCapacityIncrease,
  MAX_PROOF_ARTEFACT_BYTES,
  proofArtefactProblem,
} from "./capacityProofs";

describe("REQ-EV-5/REQ-EV-7: whether a requested capacity is an increase", () => {
  it("from a bound, only a higher figure is an increase", () => {
    expect(isCapacityIncrease(10, 20)).toBe(true);
    expect(isCapacityIncrease(10, 10)).toBe(false);
    expect(isCapacityIncrease(10, 4)).toBe(false);
  });

  it("removing the bound counts as an increase", () => {
    expect(isCapacityIncrease(10, null)).toBe(true);
  });

  it("from no bound, any bound at all is an increase — there is nothing to compare a lower one against", () => {
    expect(isCapacityIncrease(null, 4)).toBe(true);
    expect(isCapacityIncrease(null, null)).toBe(false);
  });
});

describe("a capacity proof artefact", () => {
  it("accepts a PDF, JPEG or PNG within the size limit", () => {
    expect(proofArtefactProblem({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(proofArtefactProblem({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(proofArtefactProblem({ type: "image/png", size: 1000 })).toBeNull();
  });

  it("refuses another type", () => {
    expect(proofArtefactProblem({ type: "image/svg+xml", size: 1000 })).toBe(
      "Choose a PDF, JPEG or PNG file.",
    );
  });

  it("refuses a file larger than 2 MiB, or an empty one", () => {
    expect(
      proofArtefactProblem({ type: "application/pdf", size: MAX_PROOF_ARTEFACT_BYTES + 1 }),
    ).toBe("Choose a file of at most 2 MiB.");
    expect(proofArtefactProblem({ type: "application/pdf", size: 0 })).toBe("The file is empty.");
  });
});

describe("a proof request's status", () => {
  it("is named in plain terms", () => {
    expect(describeProofStatus("pending")).toBe("Waiting for review");
    expect(describeProofStatus("approved")).toBe("Approved");
    expect(describeProofStatus("rejected")).toBe("Rejected");
  });
});
