import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { transition } from "../screens/router";
import { Screen } from "../screens/Screen";
import type { OperatorAccount } from "./grants";

interface IssuedCode {
  readonly name: string;
  readonly code: string;
  readonly expiresAt: string;
}

/** Shown once, right after a code is issued: Kippu keeps only its hash. */
function EnrolmentCode({ issued, onDone }: { issued: IssuedCode; onDone: () => void }) {
  const codeId = useId();
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <section>
      <h2>Enrolment code for {issued.name}</h2>
      <p>
        {issued.name} enters this code in Iriguchi to start operating. It works once, until{" "}
        {new Date(issued.expiresAt).toLocaleString()}.
      </p>
      <div className="field">
        <label htmlFor={codeId}>Enrolment code</label>
        <input
          id={codeId}
          readOnly
          value={issued.code}
          onFocus={(focused) => focused.currentTarget.select()}
        />
      </div>
      <p role="alert" className="warning">
        This code is shown only this once. Kippu keeps no copy of it, so it cannot be shown again.
        If it is lost, issue a new code.
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(issued.code).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          Copy code
        </button>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>
      {copied === true ? <p role="status">Copied.</p> : null}
      {copied === false ? (
        <p role="status">The code could not be copied. Select it and copy it yourself.</p>
      ) : null}
    </section>
  );
}

function OperatorRow({
  operator,
  onIssued,
}: {
  operator: OperatorAccount;
  onIssued: (issued: IssuedCode) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.operators.list.queryKey() });
  const issue = useMutation(
    trpc.operators.issueEnrolmentCode.mutationOptions({
      onSuccess: ({ code, expiresAt }) => onIssued({ name: operator.name, code, expiresAt }),
    }),
  );
  const revoke = useMutation(trpc.operators.revokeSessions.mutationOptions({ onSuccess: refresh }));

  return (
    <tr data-testid="operator">
      <td>{operator.name}</td>
      <td>{operator.liveSessions}</td>
      <td>
        <div className="inline-form">
          <button
            type="button"
            onClick={() => issue.mutate({ operator: operator.id })}
            disabled={issue.isPending}
          >
            Issue enrolment code
          </button>
          <button
            type="button"
            onClick={() => revoke.mutate({ operator: operator.id })}
            disabled={revoke.isPending}
          >
            Revoke sessions
          </button>
        </div>
        {revoke.isSuccess ? (
          <p role="status">
            Ended{" "}
            {revoke.data.sessionsRevoked === 1
              ? "1 session"
              : `${revoke.data.sessionsRevoked} sessions`}{" "}
            and voided{" "}
            {revoke.data.codesVoided === 1
              ? "1 unused code"
              : `${revoke.data.codesVoided} unused codes`}
            . Iriguchi refuses {operator.name}'s next check.
          </p>
        ) : null}
        {issue.isError || revoke.isError ? (
          <p role="alert" className="error">
            {describeFailure(issue.error ?? revoke.error)}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * The organiser's operators (`US-E5`): the staff who run Iriguchi at the gates.
 * Who they are lives only in Kippu; the ledger never learns it (`REQ-OP-1`).
 */
export function OperatorsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const nameId = useId();
  const operators = useQuery(trpc.operators.list.queryOptions());
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<IssuedCode | null>(null);

  const create = useMutation(
    trpc.operators.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.operators.list.queryKey() });
        setName("");
      },
    }),
  );

  function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    if (name.trim() !== "") {
      create.mutate({ name: name.trim() });
    }
  }

  return (
    <Screen id={issued === null ? "operators.list" : "operators.enrolment-code"}>
      <h1>Operators</h1>
      {issued !== null ? (
        <EnrolmentCode
          issued={issued}
          onDone={() => {
            transition("operators.enrolment-code", "operators.list");
            setIssued(null);
          }}
        />
      ) : (
        <>
          <p className="hint">
            Operators run Iriguchi at your gates. Grant each one gates of an event, for a window,
            from the event's gate access page. Who they are stays in Kippu: nothing about operators
            is written to the ledger.
          </p>
          {operators.isPending ? <p>Loading operators…</p> : null}
          {operators.isError ? (
            <p role="alert" className="error">
              {describeFailure(operators.error)}
            </p>
          ) : null}
          {operators.isSuccess && operators.data.length === 0 ? <p>No operators yet.</p> : null}
          {operators.isSuccess && operators.data.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th scope="col">Operator</th>
                  <th scope="col">Live sessions</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {operators.data.map((operator) => (
                  <OperatorRow
                    key={operator.id}
                    operator={operator}
                    onIssued={(code) => {
                      transition("operators.list", "operators.enrolment-code");
                      setIssued(code);
                    }}
                  />
                ))}
              </tbody>
            </table>
          ) : null}
          <form onSubmit={submit} aria-label="Add an operator" className="inline-form">
            <label htmlFor={nameId}>Operator name</label>
            <input id={nameId} value={name} onChange={(changed) => setName(changed.target.value)} />
            <button type="submit" disabled={create.isPending || name.trim() === ""}>
              Add operator
            </button>
            <p className="hint">
              Your own label for them, such as a staff member's name. Kept by Kippu, shown only to
              you, and never written to the ledger.
            </p>
            {create.isError ? (
              <p role="alert" className="error">
                {describeFailure(create.error)}
              </p>
            ) : null}
          </form>
        </>
      )}
    </Screen>
  );
}
