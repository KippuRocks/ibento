import type { AppRouter } from "@kippu/api";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { inferRouterOutputs } from "@trpc/server";
import type { KippuClient } from "../api/client";

export type OrganiserSession = inferRouterOutputs<AppRouter>["auth"]["organiser"]["completeSignIn"];

/**
 * Organiser sign-up: an email — an identifier, not verified in V0 — and one
 * passkey on Kippu's login relying party. The passkey is a Kippu login only,
 * never a ledger credential.
 */
export async function signUp(client: KippuClient, email: string): Promise<OrganiserSession> {
  const challenge = await client.auth.organiser.beginSignUp.mutate({ email });
  const credential = await startRegistration({ optionsJSON: challenge.options });
  return client.auth.organiser.completeSignUp.mutate({
    ceremonyId: challenge.ceremonyId,
    credential,
  });
}

/** Organiser sign-in with the passkey registered at sign-up. */
export async function signIn(client: KippuClient, email: string): Promise<OrganiserSession> {
  const challenge = await client.auth.organiser.beginSignIn.mutate({ email });
  const credential = await startAuthentication({ optionsJSON: challenge.options });
  return client.auth.organiser.completeSignIn.mutate({
    ceremonyId: challenge.ceremonyId,
    credential,
  });
}
