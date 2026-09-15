import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPCClient } from "../api/client";
import { transition } from "../screens/router";
import { Screen } from "../screens/Screen";
import { type Ceremony, signInFailureMessage } from "./messages";
import { signIn, signUp } from "./passkey";
import { useSession } from "./SessionProvider";

/** Organiser sign-in, and self-service sign-up with one passkey. */
export function SignIn() {
  const client = useTRPCClient();
  const { signedIn } = useSession();
  const emailId = useId();
  const [ceremony, setCeremony] = useState<Ceremony>("sign-in");
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { ceremony: Ceremony; email: string }) =>
      input.ceremony === "sign-up" ? signUp(client, input.email) : signIn(client, input.email),
    onSuccess: (session, input) => {
      // The console then shows the screen the URL names: with no route, the events list.
      if (input.ceremony === "sign-up") {
        transition("auth.sign-up", "events.list");
      } else {
        transition("auth.sign-in", "events.list");
      }
      signedIn(session);
    },
  });

  if (!browserSupportsWebAuthn()) {
    return (
      <Screen id="auth.unsupported">
        <section className="panel">
          <h1>Ibento</h1>
          <p role="alert">This browser does not support passkeys, which Ibento needs to sign in.</p>
        </section>
      </Screen>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ ceremony, email });
  }

  function switchTo(screen: "auth.sign-in" | "auth.sign-up") {
    const next: Ceremony = screen === "auth.sign-up" ? "sign-up" : "sign-in";
    mutation.reset();
    setCeremony(next);
  }

  const signingUp = ceremony === "sign-up";
  return (
    <Screen id={signingUp ? "auth.sign-up" : "auth.sign-in"}>
      <section className="panel">
        <h1>{signingUp ? "Create an organiser account" : "Sign in to Ibento"}</h1>
        <form onSubmit={submit}>
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            autoComplete="username webauthn"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" disabled={mutation.isPending}>
            {signingUp ? "Create account with a passkey" : "Sign in with a passkey"}
          </button>
        </form>
        {mutation.isError ? (
          <p role="alert" className="error">
            {signInFailureMessage(mutation.variables.ceremony, mutation.error)}
          </p>
        ) : null}
        <p>
          {signingUp ? (
            <button
              type="button"
              className="link"
              onClick={() => switchTo(transition("auth.sign-up", "auth.sign-in"))}
            >
              I already have an account
            </button>
          ) : (
            <button
              type="button"
              className="link"
              onClick={() => switchTo(transition("auth.sign-in", "auth.sign-up"))}
            >
              Create an organiser account
            </button>
          )}
        </p>
      </section>
    </Screen>
  );
}
