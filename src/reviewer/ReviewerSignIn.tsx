import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPCClient } from "../api/client";
import { transition } from "../screens/router";
import { Screen } from "../screens/Screen";
import { type ReviewerCeremony, reviewerAuthFailureMessage } from "./messages";
import { enrol, signIn } from "./passkey";
import { useReviewerSession } from "./ReviewerSessionProvider";

/**
 * A reviewer's sign-in, and enrolment with the one-time code the command line
 * issued (`T-021-16`; `F-021` plan §5.4). There is no self-service sign-up: a
 * reviewer account exists only once someone with deployment access creates one.
 */
export function ReviewerSignIn() {
  const client = useTRPCClient();
  const { signedIn } = useReviewerSession();
  const emailId = useId();
  const codeId = useId();
  const [ceremony, setCeremony] = useState<ReviewerCeremony>("sign-in");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { ceremony: ReviewerCeremony; email: string; code: string }) =>
      input.ceremony === "enrol"
        ? enrol(client, input.code, input.email)
        : signIn(client, input.email),
    onSuccess: (session, input) => {
      if (input.ceremony === "enrol") {
        transition("reviewer.enrol", "reviewers.queue");
      } else {
        transition("reviewer.sign-in", "reviewers.queue");
      }
      signedIn(session);
    },
  });

  if (!browserSupportsWebAuthn()) {
    return (
      <Screen id="reviewer.sign-in">
        <section className="panel">
          <h1>Kippu operations</h1>
          <p role="alert">This browser does not support passkeys, which reviewing needs.</p>
        </section>
      </Screen>
    );
  }

  function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    mutation.mutate({ ceremony, email, code });
  }

  function switchTo(screen: "reviewer.sign-in" | "reviewer.enrol") {
    mutation.reset();
    setCeremony(screen === "reviewer.enrol" ? "enrol" : "sign-in");
  }

  const enrolling = ceremony === "enrol";
  return (
    <Screen id={enrolling ? "reviewer.enrol" : "reviewer.sign-in"}>
      <section className="panel">
        <h1>{enrolling ? "Redeem your enrolment code" : "Kippu operations sign-in"}</h1>
        <form onSubmit={submit}>
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            autoComplete="username webauthn"
            required
            value={email}
            onChange={(changed) => setEmail(changed.target.value)}
          />
          {enrolling ? (
            <>
              <label htmlFor={codeId}>Enrolment code</label>
              <input
                id={codeId}
                type="text"
                required
                value={code}
                onChange={(changed) => setCode(changed.target.value)}
              />
              <p className="hint">The one-time code shared with you over a trusted channel.</p>
            </>
          ) : null}
          <button type="submit" disabled={mutation.isPending}>
            {enrolling ? "Register a passkey" : "Sign in with a passkey"}
          </button>
        </form>
        {mutation.isError ? (
          <p role="alert" className="error">
            {reviewerAuthFailureMessage(mutation.variables.ceremony, mutation.error)}
          </p>
        ) : null}
        <p>
          {enrolling ? (
            <button
              type="button"
              className="link"
              onClick={() => switchTo(transition("reviewer.enrol", "reviewer.sign-in"))}
            >
              I already enrolled
            </button>
          ) : (
            <button
              type="button"
              className="link"
              onClick={() => switchTo(transition("reviewer.sign-in", "reviewer.enrol"))}
            >
              I have an enrolment code
            </button>
          )}
        </p>
      </section>
    </Screen>
  );
}
