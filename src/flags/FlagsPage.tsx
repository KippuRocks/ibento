import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { eventName } from "../events/view";
import { Screen } from "../screens/Screen";
import { ScreenLink } from "../screens/ScreenLink";
import { type AdmissionFlag, describeCause, describeDrift, describeOutcome } from "./flags";

function short(id: string): string {
  return `${id.slice(0, 12)}…`;
}

function Details({ flag }: { flag: AdmissionFlag }) {
  if (flag.otherReports.length === 0 && flag.transfers.length === 0) {
    return <>—</>;
  }
  return (
    <ul className="compact">
      {flag.otherReports.map((other) => (
        <li key={other.reportId}>
          Also at {other.gate}: {describeOutcome(other.outcome)}
        </li>
      ))}
      {flag.transfers.map((transfer) => (
        <li key={transfer.sequence}>
          Transferred from <code>{short(transfer.from)}</code> to <code>{short(transfer.to)}</code>{" "}
          at {new Date(transfer.recordedAt).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}

/** One flagged admission. */
export function FlagRow({ flag, operatorName }: { flag: AdmissionFlag; operatorName: string }) {
  return (
    <tr data-testid="flag" data-cause={flag.cause}>
      <td>{describeCause(flag.cause)}</td>
      <td>{flag.gate}</td>
      <td>{operatorName}</td>
      <td>{flag.refusal === null ? "None" : <code>{flag.refusal.errorCode}</code>}</td>
      <td>{describeDrift(flag.clockDrift)}</td>
      <td>{new Date(flag.presentedAt).toLocaleString()}</td>
      <td>
        <code title={flag.ticket}>{short(flag.ticket)}</code>
      </td>
      <td>
        <Details flag={flag} />
      </td>
    </tr>
  );
}

/**
 * The provisional-admission flag inbox (`REQ-OP-3`): every admission decided at
 * a gate that the ledger later refused, with its cause, and every report from a
 * gate whose clock was outside tolerance. Flags are evidence for the organiser,
 * computed from Kippu's copy of the ledger; they are never ledger facts.
 */
export function FlagsPage({ event: id }: { event: string }) {
  const trpc = useTRPC();
  const read = useQuery(trpc.derived.events.get.queryOptions({ event: id }));
  const operators = useQuery(trpc.operators.list.queryOptions());
  const flags = useQuery(
    trpc.derived.admissionFlags.list.queryOptions({ event: id }, { refetchInterval: 10_000 }),
  );
  const names = new Map((operators.data ?? []).map((operator) => [operator.id, operator.name]));
  const event = read.data?.event ?? null;
  const failure = flags.error ?? read.error ?? operators.error;

  return (
    <Screen id="event.flags">
      <div className="heading-row">
        <h1>Admission flags{event === null ? "" : `: ${eventName(event)}`}</h1>
        <ScreenLink from="event.flags" to="event.detail" params={{ event: id }}>
          Back to the event
        </ScreenLink>
      </div>
      <p className="hint">
        A gate admits before the ledger records the attendance. When the ledger then refuses such an
        admission, it is flagged here with its cause, as is any report from a gate whose clock was
        more than 10 seconds from Kippu's. Flags are read from Kippu's copy of the ledger: a refusal
        explained by a transfer the copy has not read yet shows another reason until it has.
      </p>
      {failure ? (
        <p role="alert" className="error">
          {describeFailure(failure)}
        </p>
      ) : null}
      {flags.isPending ? <p>Loading flags…</p> : null}
      {flags.isSuccess ? (
        <p className="note" data-testid="flags-freshness">
          {flags.data.freshness.lastRecordedAt === null
            ? "Kippu's copy has read nothing of the ledger yet."
            : `Kippu's copy has read the ledger up to ${new Date(flags.data.freshness.lastRecordedAt).toLocaleString()}.`}
        </p>
      ) : null}
      {flags.isSuccess && flags.data.flags.length === 0 ? <p>No flags.</p> : null}
      {flags.isSuccess && flags.data.flags.length > 0 ? (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Cause</th>
                <th scope="col">Gate</th>
                <th scope="col">Operator</th>
                <th scope="col">Ledger refusal</th>
                <th scope="col">Gate clock</th>
                <th scope="col">Presented</th>
                <th scope="col">Ticket</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {flags.data.flags.map((flag) => (
                <FlagRow
                  key={flag.reportId}
                  flag={flag}
                  operatorName={names.get(flag.operator) ?? "Unknown operator"}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Screen>
  );
}
