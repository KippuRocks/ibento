import type { AppRouter } from "@kippurocks/api";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { inferRouterOutputs } from "@trpc/server";
import type { KippuClient } from "../api/client";

export type ReviewerSessionResult =
  inferRouterOutputs<AppRouter>["reviewers"]["enrolment"]["complete"];

/**
 * Redeems a reviewer's one-time enrolment code (`T-021-16`; `F-021` plan §5.4):
 * the email it was created with and a passkey on Kippu's login relying party —
 * the same one an organiser signs in with, and never a ledger credential.
 */
export async function enrol(
  client: KippuClient,
  code: string,
  email: string,
): Promise<ReviewerSessionResult> {
  const challenge = await client.reviewers.enrolment.begin.mutate({ code, email });
  const credential = await startRegistration({ optionsJSON: challenge.options });
  return client.reviewers.enrolment.complete.mutate({
    ceremonyId: challenge.ceremonyId,
    credential,
  });
}

/** A reviewer signs in with the passkey registered at enrolment. */
export async function signIn(client: KippuClient, email: string): Promise<ReviewerSessionResult> {
  const challenge = await client.reviewers.signIn.begin.mutate({ email });
  const credential = await startAuthentication({ optionsJSON: challenge.options });
  return client.reviewers.signIn.complete.mutate({
    ceremonyId: challenge.ceremonyId,
    credential,
  });
}
