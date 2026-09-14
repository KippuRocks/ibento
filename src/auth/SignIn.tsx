import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPCClient } from "../api/client";
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
    onSuccess: signedIn,
  });

  if (!browserSupportsWebAuthn()) {
    return (
      <section className="panel">
        <h1>Ibento</h1>
        <p role="alert">This browser does not support passkeys, which Ibento needs to sign in.</p>
      </section>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ ceremony, email });
  }

  function switchTo(next: Ceremony) {
    mutation.reset();
    setCeremony(next);
  }

  const signingUp = ceremony === "sign-up";
  return (
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
          <button type="button" className="link" onClick={() => switchTo("sign-in")}>
            I already have an account
          </button>
        ) : (
          <button type="button" className="link" onClick={() => switchTo("sign-up")}>
            Create an organiser account
          </button>
        )}
      </p>
    </section>
  );
}
