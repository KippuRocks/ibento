import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { NOT_ON_SALE, SALE_ASSET_IDS, SALE_ASSETS, type SaleAsset } from "./money";

/**
 * An event's sale asset (`US-B4`; `F-021` plan, "Prices"): chosen by the
 * organiser, and fixed once the event has had a hold or a sale. Changing it
 * clears every `Purchased` class's price, and the event is not on sale until
 * each is priced again, so a change that would clear prices is confirmed first.
 */
export function SaleSection({ event }: { event: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const sale = useQuery(trpc.events.saleAsset.queryOptions({ event }));
  const classes = useQuery(trpc.events.classes.list.queryOptions({ event }));
  const [choice, setChoice] = useState<SaleAsset | "">("");
  const [confirming, setConfirming] = useState(false);

  const set = useMutation(
    trpc.events.setSaleAsset.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.events.saleAsset.queryKey({ event }) }),
          // The change cleared every Purchased class's price.
          queryClient.invalidateQueries({ queryKey: trpc.events.classes.list.queryKey({ event }) }),
        ]);
        setChoice("");
        setConfirming(false);
      },
    }),
  );

  if (sale.isPending) {
    return <p>Loading the sale asset…</p>;
  }
  if (sale.isError) {
    return (
      <p role="alert" className="error">
        {describeFailure(sale.error)}
      </p>
    );
  }
  const { asset, fixed } = sale.data;
  const chosen = choice === "" ? asset : choice;
  const purchased = (classes.data ?? []).filter((defined) => defined.provenance === "Purchased");
  const priced = purchased.filter((defined) => defined.price !== null);
  // kippu-api's account of which Purchased classes wait for a price: the event is off sale until none do.
  const names = new Map(purchased.map((defined) => [defined.id, defined.name]));
  const unpriced = sale.data.unpriced.map(
    (classId) => names.get(classId) ?? `Class ${classId.slice(0, 12)}…`,
  );

  return (
    <section aria-labelledby="sale-heading">
      <h2 id="sale-heading">Sale</h2>
      <p data-testid="sale-status">
        {asset === null
          ? NOT_ON_SALE
          : unpriced.length > 0
            ? `Sales are priced in ${SALE_ASSETS[asset].code}. Not on sale until every Purchased class has a price: ${unpriced.join(", ")}.`
            : `Sales are priced in ${SALE_ASSETS[asset].code}, with ${SALE_ASSETS[asset].decimals} decimal places. The event is on sale while it is Active.`}
      </p>
      {asset !== null && unpriced.length > 0 ? (
        <div className="warning">
          <p>
            Set a price in {SALE_ASSETS[asset].code} for each of these classes, under Prices below:
          </p>
          <ul data-testid="unpriced-classes">
            {unpriced.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {fixed ? (
        <p className="hint">The sale asset is fixed: the event has had a hold or a sale.</p>
      ) : (
        <form
          aria-label="Sale asset"
          className="inline-form"
          onSubmit={(submitted) => {
            submitted.preventDefault();
            if (chosen === null || chosen === asset) {
              return;
            }
            if (asset !== null && priced.length > 0) {
              setConfirming(true);
            } else {
              set.mutate({ event, asset: chosen });
            }
          }}
        >
          <label htmlFor={id}>Sale asset</label>
          <select
            id={id}
            value={chosen ?? ""}
            onChange={(changed) => {
              setChoice(changed.target.value as SaleAsset | "");
              setConfirming(false);
            }}
          >
            {asset === null ? <option value="">Choose an asset</option> : null}
            {SALE_ASSET_IDS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {SALE_ASSETS[candidate].code} ({candidate})
              </option>
            ))}
          </select>
          <button type="submit" disabled={set.isPending || chosen === null || chosen === asset}>
            Set sale asset
          </button>
          <p className="hint">
            It can change until the event's first hold, and is fixed from then on.
          </p>
        </form>
      )}
      {confirming && asset !== null && chosen !== null && chosen !== asset ? (
        <div role="alertdialog" aria-label="Confirm the sale asset change" className="warning">
          <p>
            Changing the sale asset from {SALE_ASSETS[asset].code} to {SALE_ASSETS[chosen].code}{" "}
            clears the price of every Purchased class:{" "}
            {priced.map((defined) => defined.name).join(", ")}. The event is not on sale until each
            is priced again in {SALE_ASSETS[chosen].code}.
          </p>
          <div className="actions">
            <button
              type="button"
              disabled={set.isPending}
              onClick={() => set.mutate({ event, asset: chosen })}
            >
              Change to {SALE_ASSETS[chosen].code} and clear prices
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Keep {SALE_ASSETS[asset].code}
            </button>
          </div>
        </div>
      ) : null}
      {set.isError ? (
        <p role="alert" className="error">
          {describeFailure(set.error)}
        </p>
      ) : null}
    </section>
  );
}
