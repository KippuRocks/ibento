import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure, failureOf } from "../api/errors";
import {
  describeProofStatus,
  isCapacityIncrease,
  isProofArtefactType,
  PROOF_ARTEFACT_TYPES,
  type ProofArtefactType,
  proofArtefactProblem,
} from "./capacityProofs";
import { base64Of } from "./images";
import type { EventView } from "./view";

/** A capacity as a request or decrease form carries it: digits, or empty for "no bound". */
function parseCapacity(text: string): { ok: true; capacity: number | null } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: true, capacity: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? { ok: true, capacity: value } : { ok: false };
}

function DecreaseForm({ event, current }: { event: string; current: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const [text, setText] = useState(String(current));

  const decrease = useMutation(
    trpc.events.decreaseCapacity.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: trpc.derived.events.get.queryKey({ event }) }),
    }),
  );

  const parsed = parseCapacity(text);
  const reason = decrease.isError ? failureOf(decrease.error).reason : null;

  function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    if (!parsed.ok || parsed.capacity === null) {
      return;
    }
    decrease.mutate({ event, capacity: parsed.capacity });
  }

  return (
    <form onSubmit={submit} aria-label="Decrease capacity" className="inline-form">
      <label htmlFor={id}>New capacity</label>
      <input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={(changed) => setText(changed.target.value)}
      />
      <button type="submit" disabled={decrease.isPending || !parsed.ok || parsed.capacity === null}>
        Decrease capacity
      </button>
      <p className="hint">
        Applies immediately, down to the tickets already issued — never below. Raising capacity
        needs a validated proof, requested below.
      </p>
      {decrease.isError ? (
        <p role="alert" className="error">
          {describeFailure(decrease.error)}
          {reason === "held" ? " (outstanding holds make the difference.)" : ""}
        </p>
      ) : null}
    </form>
  );
}

function RequestIncreaseForm({ event, current }: { event: string; current: number | null }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const capacityId = useId();
  const [removeBound, setRemoveBound] = useState(current === null);
  const [text, setText] = useState("");
  const [artefact, setArtefact] = useState<{
    mediaType: ProofArtefactType;
    data: string;
    name: string;
  } | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const request = useMutation(
    trpc.events.capacityProofs.request.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.events.capacityProofs.list.queryKey({ event }),
        });
        setText("");
        setArtefact(null);
        setProblem(null);
      },
    }),
  );

  async function chosen(change: ChangeEvent<HTMLInputElement>) {
    const input = change.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (file === undefined) {
      return;
    }
    const refused = proofArtefactProblem(file);
    setFileProblem(refused);
    if (refused !== null || !isProofArtefactType(file.type)) {
      setArtefact(null);
      return;
    }
    setArtefact({ mediaType: file.type, data: await base64Of(file), name: file.name });
  }

  const parsed = removeBound ? { ok: true as const, capacity: null } : parseCapacity(text);
  const requested = parsed.ok ? parsed.capacity : undefined;
  const increase = parsed.ok && isCapacityIncrease(current, requested ?? null);

  function submit(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    if (!parsed.ok) {
      setProblem("Write the requested capacity as a whole number, or remove the bound.");
      return;
    }
    if (!increase) {
      setProblem("The requested capacity is not higher than the event's current one.");
      return;
    }
    if (artefact === null) {
      setProblem("Attach an artefact attesting the venue supports this capacity.");
      return;
    }
    setProblem(null);
    request.mutate({
      event,
      capacity: parsed.capacity,
      artefact: { mediaType: artefact.mediaType, data: artefact.data },
    });
  }

  return (
    <form onSubmit={submit} aria-label="Request a capacity increase">
      <h3>Request an increase</h3>
      <p className="hint">
        Needs an artefact attesting the venue supports the higher capacity: a fire-safety
        certificate or similar, reviewed by a Kippu reviewer before it reaches the ledger
        (`REQ-EV-5`, `REQ-EV-6`).
      </p>
      <div className="field">
        <label htmlFor={capacityId}>Requested capacity</label>
        <input
          id={capacityId}
          inputMode="numeric"
          value={text}
          disabled={removeBound}
          onChange={(changed) => setText(changed.target.value)}
        />
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={removeBound}
            onChange={(changed) => {
              setRemoveBound(changed.target.checked);
              if (changed.target.checked) {
                setText("");
              }
            }}
          />
          Remove the capacity bound (unbounded issuance)
        </label>
      </div>
      <div className="field">
        <label htmlFor={`${capacityId}-artefact`}>Artefact</label>
        <input
          id={`${capacityId}-artefact`}
          type="file"
          accept={PROOF_ARTEFACT_TYPES.join(",")}
          onChange={(change) => {
            chosen(change).catch(() => undefined);
          }}
        />
        {artefact !== null ? <p className="hint">Attached: {artefact.name}</p> : null}
      </div>
      {fileProblem !== null ? (
        <p role="alert" className="error">
          {fileProblem}
        </p>
      ) : null}
      {problem !== null ? (
        <p role="alert" className="error">
          {problem}
        </p>
      ) : null}
      {request.isError ? (
        <p role="alert" className="error">
          {describeFailure(request.error)}
        </p>
      ) : null}
      <div className="actions">
        <button type="submit" disabled={request.isPending}>
          Request review
        </button>
      </div>
    </form>
  );
}

/**
 * Capacity changes (`US-A6`; `F-021` plan §5.4): a decrease applies immediately,
 * down to the tickets already issued; an increase — including removing the
 * bound (`REQ-EV-7`) — needs a validated capacity proof and waits for a Kippu
 * reviewer (`REQ-EV-5`, `REQ-EV-6`). Capacity cannot change while the event is
 * `Sealed`, `Cancelled` or `Finished` (`AC-A6.5`).
 */
export function CapacitySection({ event }: { event: EventView }) {
  const trpc = useTRPC();
  const requests = useQuery(trpc.events.capacityProofs.list.queryOptions({ event: event.id }));
  const changeable = event.status === "Active";
  const pending = (requests.data ?? []).find((request) => request.status === "pending") ?? null;

  return (
    <section aria-labelledby="capacity-heading">
      <h2 id="capacity-heading">Capacity</h2>
      <p data-testid="capacity-value">
        {event.maxCapacity === null ? "Unbounded" : event.maxCapacity}
      </p>
      {!changeable ? (
        <p className="hint">Capacity cannot change while the event is {event.status}.</p>
      ) : (
        <>
          {event.maxCapacity !== null ? (
            <DecreaseForm event={event.id} current={event.maxCapacity} />
          ) : null}
          {pending !== null ? (
            <p className="hint" data-testid="capacity-request-pending">
              A request for {pending.capacity === null ? "an unbounded capacity" : pending.capacity}{" "}
              is waiting for review.
            </p>
          ) : (
            <RequestIncreaseForm event={event.id} current={event.maxCapacity} />
          )}
        </>
      )}
      {requests.isError ? (
        <p role="alert" className="error">
          {describeFailure(requests.error)}
        </p>
      ) : null}
      {requests.isSuccess && requests.data.length > 0 ? (
        <table data-testid="capacity-requests">
          <thead>
            <tr>
              <th scope="col">Requested</th>
              <th scope="col">Capacity</th>
              <th scope="col">Status</th>
              <th scope="col">Decided</th>
            </tr>
          </thead>
          <tbody>
            {requests.data.map((request) => (
              <tr key={request.id}>
                <td>{new Date(request.requestedAt).toLocaleString()}</td>
                <td>{request.capacity === null ? "Unbounded" : request.capacity}</td>
                <td>{describeProofStatus(request.status)}</td>
                <td>
                  {request.decidedAt === null ? "—" : new Date(request.decidedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
