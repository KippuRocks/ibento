import type { AppRouter } from "@kippu/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import { useTRPC, useTRPCClient } from "../api/client";
import { describeFailure } from "../api/errors";
import { Screen } from "../screens/Screen";

type Request = inferRouterOutputs<AppRouter>["reviewers"]["capacityProofs"]["queue"][number];

function short(id: string): string {
  return `${id.slice(0, 12)}…`;
}

/** `base64`'s bytes as a `Blob` of `mediaType`. */
function blobUrlOf(base64: string, mediaType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mediaType }));
}

/**
 * Opens the artefact in a new tab: a reviewer's own look at what the request
 * attests. A clicked link, not `window.open`, so the browser treats it as a
 * requested navigation rather than a popup once the artefact has actually
 * loaded (below) — `window.open` called after the fetch's `await` no longer
 * carries the click's own permission to open one.
 */
function ViewArtefact({ request }: { request: Request }) {
  const client = useTRPCClient();
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  async function view() {
    setState("pending");
    try {
      const artefact = await client.reviewers.capacityProofs.artefact.query({
        request: request.id,
      });
      const link = document.createElement("a");
      link.href = blobUrlOf(artefact.data, artefact.mediaType);
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button type="button" onClick={() => void view()} disabled={state === "pending"}>
        View artefact
      </button>
      {state === "error" ? <p role="alert">Could not load the artefact. Try again.</p> : null}
    </>
  );
}

/** One pending request. */
function RequestRow({ request }: { request: Request }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.reviewers.capacityProofs.queue.pathKey() });

  const approve = useMutation(
    trpc.reviewers.capacityProofs.approve.mutationOptions({ onSuccess: invalidate }),
  );
  const reject = useMutation(
    trpc.reviewers.capacityProofs.reject.mutationOptions({ onSuccess: invalidate }),
  );
  const failure = approve.error ?? reject.error;
  const deciding = approve.isPending || reject.isPending;

  return (
    <tr data-testid="proof-request">
      <td>
        <code title={request.organiserId}>{short(request.organiserId)}</code>
      </td>
      <td>
        <code title={request.event}>{short(request.event)}</code>
      </td>
      <td>{request.capacity === null ? "Unbounded" : request.capacity}</td>
      <td>
        {request.artefact.mediaType} ({request.artefact.size} bytes)
        <br />
        <ViewArtefact request={request} />
      </td>
      <td>{new Date(request.requestedAt).toLocaleString()}</td>
      <td>
        <div className="actions">
          <button
            type="button"
            disabled={deciding}
            onClick={() => approve.mutate({ request: request.id })}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={deciding}
            onClick={() => reject.mutate({ request: request.id })}
          >
            Reject
          </button>
        </div>
        {failure ? (
          <p role="alert" className="error">
            {describeFailure(failure)}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * The capacity-proof review queue (`T-021-08`, `REQ-EV-6`; `F-021` plan §5.4,
 * "Reviewers"): every pending request for an increase, oldest first, with the
 * artefact attesting the venue supports it. Approving submits the increase with
 * a proof id, under the requesting organiser's own authority; rejecting writes
 * nothing to the ledger. Both are final: a decided request never returns here.
 */
export function ReviewerQueuePage() {
  const trpc = useTRPC();
  const queue = useQuery(
    trpc.reviewers.capacityProofs.queue.queryOptions(undefined, { refetchInterval: 10_000 }),
  );

  return (
    <Screen id="reviewers.queue">
      <h1>Capacity proof review queue</h1>
      <p className="hint">
        An organiser's request for a higher capacity waits here until a reviewer decides it.
        Approving submits the increase to the ledger with a proof id; rejecting does not. Neither
        can be undone once decided.
      </p>
      {queue.isPending ? <p>Loading the queue…</p> : null}
      {queue.isError ? (
        <p role="alert" className="error">
          {describeFailure(queue.error)}
        </p>
      ) : null}
      {queue.isSuccess && queue.data.length === 0 ? <p>Nothing is waiting for review.</p> : null}
      {queue.isSuccess && queue.data.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Organiser</th>
              <th scope="col">Event</th>
              <th scope="col">Capacity requested</th>
              <th scope="col">Artefact</th>
              <th scope="col">Requested</th>
              <th scope="col">
                <span className="visually-hidden">Decision</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {queue.data.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </tbody>
        </table>
      ) : null}
    </Screen>
  );
}
