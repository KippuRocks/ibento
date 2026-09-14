import type { AppRouter } from "@kippu/api";
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { signInFailureMessage } from "./messages";

function answered(code: string, errorCode: string | null = null): TRPCClientError<AppRouter> {
  return new TRPCClientError<AppRouter>("failed", {
    result: {
      error: {
        code: -32600,
        message: "failed",
        data: { code: code as "NOT_FOUND", httpStatus: 400, errorCode },
      },
    },
  });
}

describe("sign-in failure messages", () => {
  it("shows a SPEC §10 code verbatim when the error carries one", () => {
    expect(signInFailureMessage("sign-in", answered("FORBIDDEN", "ERR-InvalidAuthorisation"))).toBe(
      "ERR-InvalidAuthorisation",
    );
  });

  it("names an email with no organiser account", () => {
    expect(signInFailureMessage("sign-in", answered("NOT_FOUND"))).toBe(
      "No organiser account uses this email.",
    );
  });

  it("sends an organiser whose email is taken to sign in", () => {
    expect(signInFailureMessage("sign-up", answered("CONFLICT"))).toMatch(/Sign in instead/);
  });

  it("tells a passkey that did not verify from one that could not be registered", () => {
    expect(signInFailureMessage("sign-in", answered("UNAUTHORIZED"))).toMatch(/did not verify/);
    expect(signInFailureMessage("sign-up", answered("UNAUTHORIZED"))).toMatch(/registered/);
  });

  it("treats a cancelled passkey prompt as cancelled, not as a failure of Kippu", () => {
    const cancelled = new Error("The operation either timed out or was not allowed.");
    cancelled.name = "NotAllowedError";
    expect(signInFailureMessage("sign-in", cancelled)).toMatch(/cancelled or timed out/);
  });

  it("falls back to an unreachable API for anything else", () => {
    expect(signInFailureMessage("sign-in", new TypeError("Failed to fetch"))).toMatch(
      /could not be reached/,
    );
  });
});
