import { WebAuthnError } from "@simplewebauthn/browser";
import { failureOf } from "../api/errors";

export type ReviewerCeremony = "sign-in" | "enrol";

/** What a reviewer is told when signing in or redeeming an enrolment code fails. */
export function reviewerAuthFailureMessage(ceremony: ReviewerCeremony, error: unknown): string {
  if (error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError")) {
    return "The passkey request was cancelled or timed out. Try again.";
  }
  if (error instanceof WebAuthnError) {
    return "This browser could not use a passkey for Kippu.";
  }
  const { errorCode, transport } = failureOf(error);
  if (errorCode !== null) {
    return errorCode;
  }
  switch (transport) {
    case "BAD_REQUEST":
      return "Enter a valid email address.";
    case "NOT_FOUND":
      return ceremony === "enrol"
        ? "The enrolment code does not match this email, or the code is wrong."
        : "No reviewer account uses this email.";
    case "UNAUTHORIZED":
      return ceremony === "enrol"
        ? "That enrolment code has been used, has expired, or is not valid for this email."
        : "The passkey did not verify. Try again.";
    default:
      return "Kippu could not be reached. Try again.";
  }
}
