import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTRPC } from "../api/client";
import { describeFailure } from "../api/errors";
import { formatMinor, NOT_ON_SALE, SALE_ASSET_IDS, SALE_ASSETS, type SaleAsset } from "./money";

/**
 * An event's sale asset (`US-B4`; `F-021` plan, "Prices"): chosen by the
 * organiser, and fixed once the event has had a hold or a sale.
 */
export function SaleSection({ event }: { event: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const sale = useQuery(trpc.events.saleAsset.queryOptions({ event }));
  const classes = useQuery(trpc.events.classes.list.queryOptions({ event }));
  const [choice, setChoice] = useState<SaleAsset | "">("");

  const set = useMutation(
    trpc.events.setSaleAsset.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.events.saleAsset.queryKey({ event }),
        });
        setChoice("");
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
  const priced = (classes.data ?? []).filter((defined) => defined.price !== null);
  const changing = asset !== null && chosen !== null && chosen !== asset;
  const example = priced[0];

  return (
    <section aria-labelledby="sale-heading">
      <h2 id="sale-heading">Sale</h2>
      <p data-testid="sale-status">
        {asset === null
          ? NOT_ON_SALE
          : `Sales are priced in ${SALE_ASSETS[asset].code}, with ${SALE_ASSETS[asset].decimals} decimal places. The event is on sale while it is Active.`}
      </p>
      {fixed ? (
        <p className="hint">The sale asset is fixed: the event has had a hold or a sale.</p>
      ) : (
        <form
          aria-label="Sale asset"
          className="inline-form"
          onSubmit={(submitted) => {
            submitted.preventDefault();
            if (chosen !== null && chosen !== asset) {
              set.mutate({ event, asset: chosen });
            }
          }}
        >
          <label htmlFor={id}>Sale asset</label>
          <select
            id={id}
            value={chosen ?? ""}
            onChange={(changed) => setChoice(changed.target.value as SaleAsset | "")}
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
      {changing && example !== undefined && example.price !== null ? (
        <p className="warning" data-testid="asset-change-warning">
          Prices are kept in the asset's smallest units, so changing the asset changes what every
          price means: {example.name} at {formatMinor(example.price, asset)} would be{" "}
          {formatMinor(example.price, chosen)}. Check each price after changing.
        </p>
      ) : null}
      {set.isError ? (
        <p role="alert" className="error">
          {describeFailure(set.error)}
        </p>
      ) : null}
    </section>
  );
}
