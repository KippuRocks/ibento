import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { formatMinor, parsePrice, SALE_ASSETS, type SaleAsset } from "../sales/money";
import {
  type ClassDraft,
  checkClass,
  describePolicy,
  describeRestrictions,
  emptyClass,
  type PolicyKind,
  type Provenance,
  PURCHASED_RESTRICTION_REFUSAL,
  type TicketClass,
} from "./draft";

/** Why a changed price leaves earlier sales alone (`F-021` plan, "Prices"). */
const PRICE_CHANGE_NOTE =
  "A new price applies only to sales from now on. Tickets already held or sold keep the price they were held at.";

function priceOf(ticketClass: TicketClass, asset: SaleAsset | null): string {
  if (ticketClass.price === null) {
    // A Purchased class loses its price when the event's sale asset changes.
    return ticketClass.provenance === "Purchased" ? "Needs a price" : "Free";
  }
  return asset === null
    ? `${ticketClass.price} minor units`
    : formatMinor(ticketClass.price, asset);
}

function PriceForm({
  event,
  ticketClass,
  asset,
}: {
  event: string;
  ticketClass: TicketClass;
  asset: SaleAsset;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const [price, setPrice] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const change = useMutation(
    trpc.events.classes.setPrice.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.events.classes.list.queryKey({ event }) }),
          // Pricing the last unpriced class puts the event back on sale.
          queryClient.invalidateQueries({ queryKey: trpc.events.saleAsset.queryKey({ event }) }),
        ]);
        setPrice("");
      },
    }),
  );
  return (
    <form
      aria-label={`Change the price of ${ticketClass.name}`}
      className="inline-form"
      onSubmit={(submitted) => {
        submitted.preventDefault();
        const parsed = parsePrice(price, asset);
        if (!parsed.ok) {
          setProblem(parsed.problem);
          return;
        }
        setProblem(null);
        change.mutate({ event, class: ticketClass.id, price: parsed.minor });
      }}
    >
      <label htmlFor={id}>
        New price of {ticketClass.name} ({SALE_ASSETS[asset].code})
      </label>
      <input id={id} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      <button type="submit" disabled={change.isPending}>
        Set price
      </button>
      {problem !== null ? (
        <p role="alert" className="error">
          {problem}
        </p>
      ) : null}
      {change.isError ? (
        <p role="alert" className="error">
          {describeFailure(change.error)}
        </p>
      ) : null}
    </form>
  );
}

function ClassForm({
  event,
  asset,
  onDefined,
}: {
  event: string;
  asset: SaleAsset | null;
  onDefined: (name: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ids = {
    name: useId(),
    description: useId(),
    policy: useId(),
    max: useId(),
    until: useId(),
    quota: useId(),
    price: useId(),
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
    const check = checkClass(event, draft, asset);
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

      {purchased ? (
        <div className="field">
          <label htmlFor={ids.price}>
            Price{asset === null ? "" : ` (${SALE_ASSETS[asset].code})`}
          </label>
          <input
            id={ids.price}
            inputMode="decimal"
            disabled={asset === null}
            value={draft.price}
            onChange={(e) => set("price", e.target.value)}
          />
          <p className="hint">
            {asset === null
              ? "Choose the event's sale asset first: a price is in that asset."
              : `In ${SALE_ASSETS[asset].code}, with up to ${SALE_ASSETS[asset].decimals} decimal places after a dot. Kippu keeps prices; they never reach the ledger.`}
          </p>
        </div>
      ) : null}

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
  const sale = useQuery(trpc.events.saleAsset.queryOptions({ event }));
  const asset = sale.data?.asset ?? null;
  const purchased = (classes.data ?? []).filter((defined) => defined.provenance === "Purchased");
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
              <th scope="col">Price</th>
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
                <td>{priceOf(ticketClass, asset)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {purchased.length > 0 && asset !== null ? (
        <div className="prices">
          <h3>Prices</h3>
          <p className="hint">{PRICE_CHANGE_NOTE}</p>
          {purchased.map((ticketClass) => (
            <PriceForm key={ticketClass.id} event={event} ticketClass={ticketClass} asset={asset} />
          ))}
        </div>
      ) : null}
      {defined === null ? null : <p role="status">Defined the class {defined}.</p>}
      {sale.isPending ? null : <ClassForm event={event} asset={asset} onDefined={setDefined} />}
    </section>
  );
}
