import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { parseWindowSeconds, secondsOf } from "./window";

/**
 * How long an access pass for the event stays valid (`NFR-5`): the organiser's
 * setting in Kippu, between 10 seconds and the ledger's maximum pass window, 60
 * seconds by default. The bounds come from kippu-api, never from the console.
 */
export function PassWindowSection({ event }: { event: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const window = useQuery(trpc.events.passWindow.queryOptions({ event }));
  const [seconds, setSeconds] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const set = useMutation(
    trpc.events.setPassWindow.mutationOptions({
      onSuccess: (updated) => {
        queryClient.setQueryData(trpc.events.passWindow.queryKey({ event }), updated);
        setSeconds("");
      },
    }),
  );

  if (window.isPending) {
    return <p>Loading the pass window…</p>;
  }
  if (window.isError) {
    return (
      <p role="alert" className="error">
        {describeFailure(window.error)}
      </p>
    );
  }
  const current = window.data;

  function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    const parsed = parseWindowSeconds(seconds, current);
    if (!parsed.ok) {
      setProblem(parsed.problem);
      return;
    }
    setProblem(null);
    set.mutate({ event, windowMs: parsed.windowMs });
  }

  return (
    <section aria-labelledby="pass-window-heading">
      <h2 id="pass-window-heading">Access passes</h2>
      <p data-testid="pass-window">
        A holder's access pass for this event stays valid for {secondsOf(current.windowMs)} seconds
        {current.isDefault ? " (the default)" : ""}.
      </p>
      <form onSubmit={submit} aria-label="Pass window" className="inline-form">
        <label htmlFor={id}>Pass window (seconds)</label>
        <input
          id={id}
          inputMode="numeric"
          placeholder={secondsOf(current.windowMs)}
          value={seconds}
          onChange={(changed) => setSeconds(changed.target.value)}
        />
        <button type="submit" disabled={set.isPending}>
          Set pass window
        </button>
        <p className="hint">
          Between {secondsOf(current.minimumMs)} and {secondsOf(current.maximumMs)} seconds. Short
          enough to limit sharing a screenshot of a pass, long enough to survive the queue at the
          gate. Kippu keeps this setting; it is not recorded on the ledger.
        </p>
        {problem !== null ? (
          <p role="alert" className="error">
            {problem}
          </p>
        ) : null}
        {set.isError ? (
          <p role="alert" className="error">
            {describeFailure(set.error)}
          </p>
        ) : null}
      </form>
    </section>
  );
}
