import { WebAuthnError } from "@simplewebauthn/browser";
import { failureOf } from "../api/errors";

export type Ceremony = "sign-in" | "sign-up";

/** What the organiser is told when signing in or signing up fails. */
export function signInFailureMessage(ceremony: Ceremony, error: unknown): string {
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
      return "No organiser account uses this email.";
    case "CONFLICT":
      return "An organiser account already uses this email. Sign in instead.";
    case "UNAUTHORIZED":
      return ceremony === "sign-up"
        ? "The passkey could not be registered. Try again."
        : "The passkey did not verify. Try again.";
    default:
      return "Kippu could not be reached. Try again.";
  }
}
