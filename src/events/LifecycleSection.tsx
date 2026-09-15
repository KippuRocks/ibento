import type { StatusChanged } from "@kippurocks/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPC, useTRPCClient } from "../api/client";
import { describeFailure } from "../api/errors";
import {
  canCancel,
  canFinish,
  canScheduleFinish,
  canSeal,
  describeScheduleStatus,
  parseFinishAt,
} from "./lifecycle";
import type { EventView } from "./view";

type Confirming = "seal" | "cancel" | "finish" | null;

/**
 * Seal, cancel and finish (`US-A4`, `US-A5`, `REQ-EV-12`). Each reaches the
 * ledger and cannot be undone once it does, so each is confirmed with exactly
 * what it does before it is submitted (`F-040` plan, "Irreversible actions").
 * `Cancelled` and `Finished` are terminal (`AC-A5.6`): once reached, nothing
 * here remains to do.
 */
export function LifecycleSection({ event }: { event: EventView }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const scheduleFieldId = useId();
  const [at, setAt] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.derived.events.get.queryKey({ event: event.id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.events.finishSchedule.queryKey({ event: event.id }),
      }),
    ]);
  };

  /**
   * Kippu's derived copy trails the ledger (`NFR-11`): a status change is a
   * ledger write, so the copy is asked to catch up to its cursor before the
   * console re-reads the event — otherwise a refetch that lands ahead of the
   * copy would show the old status with nothing left to prompt another one.
   * `cursor` is `null` when the ledger already had the status and nothing was
   * written (calling cancel again, say): nothing to wait for then.
   */
  const settle = async (changed: StatusChanged) => {
    if (changed.cursor !== null) {
      await client.derived.waitFor.query({ cursor: changed.cursor, timeout: 10_000 });
    }
    setConfirming(null);
    await refresh();
  };

  const seal = useMutation(trpc.events.seal.mutationOptions({ onSuccess: settle }));
  const cancel = useMutation(trpc.events.cancel.mutationOptions({ onSuccess: settle }));
  const finish = useMutation(trpc.events.finish.mutationOptions({ onSuccess: settle }));

  const schedule = useQuery(trpc.events.finishSchedule.queryOptions({ event: event.id }));
  const scheduleFinish = useMutation(
    trpc.events.scheduleFinish.mutationOptions({
      onSuccess: (updated) => {
        queryClient.setQueryData(trpc.events.finishSchedule.queryKey({ event: event.id }), updated);
        setAt("");
        setProblem(null);
      },
    }),
  );
  const cancelSchedule = useMutation(
    trpc.events.cancelScheduledFinish.mutationOptions({
      onSuccess: (updated) =>
        queryClient.setQueryData(trpc.events.finishSchedule.queryKey({ event: event.id }), updated),
    }),
  );

  const failure =
    seal.error ??
    cancel.error ??
    finish.error ??
    schedule.error ??
    scheduleFinish.error ??
    cancelSchedule.error;

  if (event.status === "Cancelled" || event.status === "Finished") {
    return (
      <section aria-labelledby="lifecycle-heading">
        <h2 id="lifecycle-heading">Lifecycle</h2>
        <p data-testid="lifecycle-terminal">
          {event.status === "Cancelled"
            ? "This event is cancelled: no ticket of it can be used for attendance, and nothing further can change about it. Refunds are entitled to each purchased ticket's original purchaser."
            : "This event is finished: no ticket of it can be transferred, resold or used for attendance, and nothing about the event or its tickets can change again (INV-16)."}
        </p>
      </section>
    );
  }

  function submitSchedule(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault();
    const parsed = parseFinishAt(at, Date.now());
    if (!parsed.ok) {
      setProblem(parsed.problem);
      return;
    }
    setProblem(null);
    scheduleFinish.mutate({ event: event.id, at: parsed.at });
  }

  const activeSchedule = schedule.data ?? null;
  const scheduleIsLive = activeSchedule !== null && activeSchedule.status === "scheduled";

  return (
    <section aria-labelledby="lifecycle-heading">
      <h2 id="lifecycle-heading">Lifecycle</h2>
      <div className="actions">
        {canSeal(event.status) ? (
          <button type="button" onClick={() => setConfirming("seal")} disabled={seal.isPending}>
            Seal the event
          </button>
        ) : null}
        {canCancel(event.status) ? (
          <button type="button" onClick={() => setConfirming("cancel")} disabled={cancel.isPending}>
            Cancel the event
          </button>
        ) : null}
        {canFinish(event.status) ? (
          <button type="button" onClick={() => setConfirming("finish")} disabled={finish.isPending}>
            Finish now
          </button>
        ) : null}
      </div>

      {confirming === "seal" ? (
        <div role="alertdialog" aria-label="Confirm sealing the event" className="warning">
          <p>
            Sealing stops all further issuance: no more tickets can be issued or sold for this
            event. Tickets already issued keep working exactly as before — transfer, resale and
            attendance all continue normally. This cannot be undone.
          </p>
          <div className="actions">
            <button
              type="button"
              disabled={seal.isPending}
              onClick={() => seal.mutate({ event: event.id })}
            >
              Seal the event
            </button>
            <button type="button" onClick={() => setConfirming(null)}>
              Keep it open
            </button>
          </div>
        </div>
      ) : null}

      {confirming === "cancel" ? (
        <div role="alertdialog" aria-label="Confirm cancelling the event" className="warning">
          <p>
            Cancelling stops every ticket of this event from being used for attendance. Every
            purchaser of a sold ticket becomes entitled to a refund, owed to them as the ticket's
            original purchaser, whatever transfers followed. This cannot be undone.
          </p>
          <div className="actions">
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ event: event.id })}
            >
              Cancel the event
            </button>
            <button type="button" onClick={() => setConfirming(null)}>
              Keep the event
            </button>
          </div>
        </div>
      ) : null}

      {confirming === "finish" ? (
        <div role="alertdialog" aria-label="Confirm finishing the event" className="warning">
          <p>
            Finishing freezes every ticket of this event alike: no transfer, no resale, no
            attendance, and nothing about the event or its tickets can change again (INV-16). This
            cannot be undone.
          </p>
          <div className="actions">
            <button
              type="button"
              disabled={finish.isPending}
              onClick={() => finish.mutate({ event: event.id })}
            >
              Finish now
            </button>
            <button type="button" onClick={() => setConfirming(null)}>
              Keep it open
            </button>
          </div>
        </div>
      ) : null}

      {failure ? (
        <p role="alert" className="error">
          {describeFailure(failure)}
        </p>
      ) : null}

      {canScheduleFinish(event.status) ? (
        <section aria-labelledby="scheduled-finish-heading">
          <h3 id="scheduled-finish-heading">Scheduled finish</h3>
          <p className="hint">
            Off by default. Once set, Kippu notices you 24 hours beforehand and finishes the event
            itself at the time you choose. You can cancel the schedule any time before it runs.
          </p>
          {schedule.isPending ? <p>Loading the schedule…</p> : null}
          {schedule.isSuccess && activeSchedule === null ? (
            <p data-testid="finish-schedule-status">No scheduled finish.</p>
          ) : null}
          {activeSchedule !== null ? (
            <p data-testid="finish-schedule-status">
              {describeScheduleStatus(activeSchedule.status)}, for{" "}
              {new Date(activeSchedule.at).toLocaleString()}
              {activeSchedule.noticedAt !== null
                ? `. Noticed at ${new Date(activeSchedule.noticedAt).toLocaleString()}.`
                : "."}
              {activeSchedule.status === "refused" && activeSchedule.errorCode !== null
                ? ` (${activeSchedule.errorCode})`
                : ""}
            </p>
          ) : null}
          {scheduleIsLive ? (
            <div className="actions">
              <button
                type="button"
                disabled={cancelSchedule.isPending}
                onClick={() => cancelSchedule.mutate({ event: event.id })}
              >
                Cancel the scheduled finish
              </button>
            </div>
          ) : (
            <form onSubmit={submitSchedule} aria-label="Schedule a finish" className="inline-form">
              <label htmlFor={scheduleFieldId}>Finish at</label>
              <input
                id={scheduleFieldId}
                type="datetime-local"
                value={at}
                onChange={(changed) => setAt(changed.target.value)}
              />
              <button type="submit" disabled={scheduleFinish.isPending}>
                Schedule finish
              </button>
              {problem !== null ? (
                <p role="alert" className="error">
                  {problem}
                </p>
              ) : null}
            </form>
          )}
        </section>
      ) : null}
    </section>
  );
}
