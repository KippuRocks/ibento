import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { eventName } from "../events/view";
import { Screen } from "../screens/Screen";
import { ScreenLink } from "../screens/ScreenLink";
import {
  describeGrantStatus,
  grantStatus,
  type OperatorAccount,
  type OperatorGrant,
  parseGates,
  parseWindow,
} from "./grants";

function GrantRow({ grant, operatorName }: { grant: OperatorGrant; operatorName: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const revoke = useMutation(
    trpc.operators.grants.revoke.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.operators.grants.list.pathKey() }),
    }),
  );
  const status = grantStatus(grant, Date.now());
  return (
    <tr data-testid="grant">
      <td>{operatorName}</td>
      <td>{grant.gates.join(", ")}</td>
      <td>{new Date(grant.from).toLocaleString()}</td>
      <td>{new Date(grant.until).toLocaleString()}</td>
      <td>{describeGrantStatus(status)}</td>
      <td>
        {status === "revoked" ? null : (
          <button
            type="button"
            onClick={() => revoke.mutate({ grant: grant.id })}
            disabled={revoke.isPending}
          >
            Revoke
          </button>
        )}
        {revoke.isError ? (
          <p role="alert" className="error">
            {describeFailure(revoke.error)}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

function GrantForm({ event, operators }: { event: string; operators: readonly OperatorAccount[] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ids = { operator: useId(), gates: useId(), from: useId(), until: useId() };
  const [operator, setOperator] = useState("");
  const [gates, setGates] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [problems, setProblems] = useState<readonly string[]>([]);

  const grant = useMutation(
    trpc.operators.grants.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.operators.grants.list.pathKey() });
        setGates("");
      },
    }),
  );

  const chosen = operators.find((candidate) => candidate.id === operator) ?? operators[0];

  function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    const parsedGates = parseGates(gates);
    const window = parseWindow(from, until);
    const found = [
      ...(parsedGates.ok ? [] : [parsedGates.problem]),
      ...(window.ok ? [] : [window.problem]),
    ];
    setProblems(found);
    if (chosen === undefined || !parsedGates.ok || !window.ok) {
      return;
    }
    grant.mutate({
      operator: chosen.id,
      event,
      gates: [...parsedGates.gates],
      from: window.from,
      until: window.until,
    });
  }

  return (
    <form onSubmit={submit} aria-label="Grant gate access">
      <h2>Grant gate access</h2>
      <div className="field">
        <label htmlFor={ids.operator}>Operator</label>
        <select
          id={ids.operator}
          value={chosen?.id ?? ""}
          onChange={(changed) => setOperator(changed.target.value)}
        >
          {operators.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={ids.gates}>Gates</label>
        <textarea
          id={ids.gates}
          rows={3}
          value={gates}
          onChange={(changed) => setGates(changed.target.value)}
        />
        <p className="hint">
          One gate per line, such as North door. Iriguchi names the gate exactly as written here.
        </p>
      </div>
      <div className="field">
        <label htmlFor={ids.from}>From</label>
        <input
          id={ids.from}
          type="datetime-local"
          value={from}
          onChange={(changed) => setFrom(changed.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={ids.until}>Until</label>
        <input
          id={ids.until}
          type="datetime-local"
          value={until}
          onChange={(changed) => setUntil(changed.target.value)}
        />
        <p className="hint">In this browser's time zone. The grant ends just before this time.</p>
      </div>
      {problems.length > 0 ? (
        <ul role="alert" className="error">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {grant.isError ? (
        <p role="alert" className="error">
          {describeFailure(grant.error)}
        </p>
      ) : null}
      <div className="actions">
        <button type="submit" disabled={grant.isPending}>
          Grant access
        </button>
      </div>
    </form>
  );
}

/**
 * Who may operate which gates of an event, and when (`US-E5`, `AC-E5.1`). Granting
 * and revoking happen entirely within Kippu: no ledger state changes. A revoked
 * or out-of-window operator's Iriguchi refuses to admit on its next check.
 */
export function EventOperatorsPage({ event: id }: { event: string }) {
  const trpc = useTRPC();
  const read = useQuery(trpc.derived.events.get.queryOptions({ event: id }));
  const operators = useQuery(trpc.operators.list.queryOptions());
  const grants = useQuery(trpc.operators.grants.list.queryOptions({ event: id, operator: null }));
  const names = new Map((operators.data ?? []).map((operator) => [operator.id, operator.name]));
  const failure = read.error ?? operators.error ?? grants.error;
  const event = read.data?.event ?? null;

  return (
    <Screen id="event.operators">
      <div className="heading-row">
        <h1>Gate access{event === null ? "" : `: ${eventName(event)}`}</h1>
        <ScreenLink from="event.operators" to="event.detail" params={{ event: id }}>
          Back to the event
        </ScreenLink>
      </div>
      <p className="hint">
        Grants and revocations take effect on Iriguchi's next check, and are kept in Kippu only:
        nothing here is written to the ledger.
      </p>
      {failure ? (
        <p role="alert" className="error">
          {describeFailure(failure)}
        </p>
      ) : null}
      {grants.isPending || operators.isPending ? <p>Loading gate access…</p> : null}
      {grants.isSuccess && grants.data.length === 0 ? (
        <p>No one has been granted access yet.</p>
      ) : null}
      {grants.isSuccess && grants.data.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Operator</th>
              <th scope="col">Gates</th>
              <th scope="col">From</th>
              <th scope="col">Until</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {grants.data.map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                operatorName={names.get(grant.operator) ?? "Unknown operator"}
              />
            ))}
          </tbody>
        </table>
      ) : null}
      {operators.isSuccess && operators.data.length === 0 ? (
        <p>
          Add an operator on the{" "}
          <ScreenLink from="event.operators" to="operators.list" params={{}}>
            operators page
          </ScreenLink>{" "}
          before granting access.
        </p>
      ) : null}
      {operators.isSuccess && operators.data.length > 0 ? (
        <GrantForm event={id} operators={operators.data} />
      ) : null}
    </Screen>
  );
}
