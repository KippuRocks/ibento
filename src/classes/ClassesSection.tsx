import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import {
  type ClassDraft,
  checkClass,
  describePolicy,
  describeRestrictions,
  emptyClass,
  type PolicyKind,
  type Provenance,
  PURCHASED_RESTRICTION_REFUSAL,
} from "./draft";

function ClassForm({ event, onDefined }: { event: string; onDefined: (name: string) => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ids = {
    name: useId(),
    description: useId(),
    policy: useId(),
    max: useId(),
    until: useId(),
    quota: useId(),
  };
  const [draft, setDraft] = useState<ClassDraft>(emptyClass);
  const [problems, setProblems] = useState<readonly string[]>([]);

  const define = useMutation(
    trpc.events.classes.define.mutationOptions({
      onSuccess: async (defined) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.events.classes.list.queryKey({ event }),
        });
        setDraft(emptyClass());
        onDefined(defined.name);
      },
    }),
  );

  const set = <K extends keyof ClassDraft>(key: K, value: ClassDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    const check = checkClass(event, draft);
    if (!check.ok) {
      setProblems(check.problems);
      return;
    }
    setProblems([]);
    define.mutate(check.input);
  }

  const purchased = draft.provenance === "Purchased";
  return (
    <form onSubmit={submit} className="class-form" aria-label="Define a class">
      <h3>Define a class</h3>
      <div className="field">
        <label htmlFor={ids.name}>Class name</label>
        <input id={ids.name} value={draft.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={ids.description}>Class description</label>
        <textarea
          id={ids.description}
          rows={2}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
        <p className="hint">Kept by Kippu. Only the class's identifier reaches the ledger.</p>
      </div>

      <fieldset>
        <legend>Provenance</legend>
        {(["Granted", "Purchased"] as const satisfies readonly Provenance[]).map((provenance) => (
          <label className="check" key={provenance}>
            <input
              type="radio"
              name="provenance"
              value={provenance}
              checked={draft.provenance === provenance}
              onChange={() => set("provenance", provenance)}
            />
            {provenance === "Granted" ? "Granted — free tickets" : "Purchased — sold tickets"}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Attendance policy</legend>
        <div className="field">
          <label htmlFor={ids.policy}>Admits</label>
          <select
            id={ids.policy}
            value={draft.policy}
            onChange={(e) => set("policy", e.target.value as PolicyKind)}
          >
            <option value="Single">Once</option>
            <option value="Multiple">Up to a number of times</option>
            <option value="Unlimited">Any number of times</option>
          </select>
        </div>
        {draft.policy === "Multiple" ? (
          <div className="field">
            <label htmlFor={ids.max}>Maximum admissions</label>
            <input
              id={ids.max}
              inputMode="numeric"
              value={draft.max}
              onChange={(e) => set("max", e.target.value)}
            />
          </div>
        ) : null}
        {draft.policy !== "Single" ? (
          <div className="field">
            <label htmlFor={ids.until}>Admits until</label>
            <input
              id={ids.until}
              type="datetime-local"
              value={draft.until}
              onChange={(e) => set("until", e.target.value)}
            />
            <p className="hint">Leave empty for no end. In this browser's time zone.</p>
          </div>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>Restrictions</legend>
        {purchased ? (
          <p className="hint" data-testid="purchased-restrictions">
            {PURCHASED_RESTRICTION_REFUSAL}
          </p>
        ) : (
          <p className="hint">
            Restrictions are for free tickets only. Once issued, a ticket's restrictions can be
            removed but never added.
          </p>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={draft.cannotResale || draft.cannotTransfer}
            disabled={draft.cannotTransfer}
            onChange={(e) => set("cannotResale", e.target.checked)}
          />
          Cannot be resold
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.cannotTransfer}
            onChange={(e) => set("cannotTransfer", e.target.checked)}
          />
          Cannot be transferred
        </label>
        {draft.cannotTransfer ? (
          <p className="hint">A ticket that cannot be transferred cannot be resold either.</p>
        ) : null}
      </fieldset>

      <div className="field">
        <label htmlFor={ids.quota}>Class quota</label>
        <input
          id={ids.quota}
          inputMode="numeric"
          value={draft.quota}
          onChange={(e) => set("quota", e.target.value)}
        />
        <p className="hint">
          Leave empty for no class quota. Every ticket still counts against the event's capacity.
        </p>
      </div>

      {problems.length > 0 ? (
        <ul role="alert" className="error">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {define.isError ? (
        <p role="alert" className="error">
          {describeFailure(define.error)}
        </p>
      ) : null}
      <div className="actions">
        <button type="submit" disabled={define.isPending}>
          Define class
        </button>
      </div>
    </form>
  );
}

/**
 * An event's ticket classes (`US-B2`, `REQ-TC-1`): several, each configured on
 * its own. A class is Kippu data (`REQ-TC-2`).
 */
export function ClassesSection({ event }: { event: string }) {
  const trpc = useTRPC();
  const classes = useQuery(trpc.events.classes.list.queryOptions({ event }));
  const [defined, setDefined] = useState<string | null>(null);

  return (
    <section aria-labelledby="classes-heading">
      <h2 id="classes-heading">Ticket classes</h2>
      {classes.isPending ? <p>Loading classes…</p> : null}
      {classes.isError ? (
        <p role="alert" className="error">
          {describeFailure(classes.error)}
        </p>
      ) : null}
      {classes.isSuccess && classes.data.length === 0 ? <p>No classes yet.</p> : null}
      {classes.isSuccess && classes.data.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Provenance</th>
              <th scope="col">Policy</th>
              <th scope="col">Restrictions</th>
              <th scope="col">Quota</th>
            </tr>
          </thead>
          <tbody>
            {classes.data.map((ticketClass) => (
              <tr key={ticketClass.id}>
                <td>{ticketClass.name}</td>
                <td>{ticketClass.provenance}</td>
                <td>{describePolicy(ticketClass.policy)}</td>
                <td>{describeRestrictions(ticketClass.restrictions)}</td>
                <td>{ticketClass.quota ?? "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {defined === null ? null : <p role="status">Defined the class {defined}.</p>}
      <ClassForm event={event} onDefined={setDefined} />
    </section>
  );
}
