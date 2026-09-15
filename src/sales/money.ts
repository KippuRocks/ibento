import type { AppRouter } from "@kippurocks/api";
import type { inferRouterOutputs } from "@trpc/server";

/** What an event's primary sales are priced in (`F-021` plan, "Prices"). */
export type SaleAsset = NonNullable<inferRouterOutputs<AppRouter>["events"]["saleAsset"]["asset"]>;

/** Every sale asset, with how many decimal places its minor units have. */
export const SALE_ASSETS: Readonly<
  Record<SaleAsset, { readonly code: string; readonly decimals: number }>
> = {
  "COPM/2": { code: "COPM", decimals: 2 },
  "DUSD/6": { code: "DUSD", decimals: 6 },
};

export const SALE_ASSET_IDS = Object.keys(SALE_ASSETS) as SaleAsset[];

/** What the console says of an event with no sale asset. */
export const NOT_ON_SALE =
  "Not on sale: the event has no sale asset. Nothing of it can be sold until one is chosen.";

const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

export type PriceCheck =
  | { readonly ok: true; readonly minor: number }
  | { readonly ok: false; readonly problem: string };

/**
 * A price written in major units — `45000.50` — as a positive integer of the
 * asset's minor units, as kippu-api takes it.
 *
 * Exact: the digits are joined as text and read as an integer, never as a
 * floating-point number. A dot separates the decimals; there are no thousands
 * separators, and no more decimals than the asset has.
 */
export function parsePrice(text: string, asset: SaleAsset): PriceCheck {
  const { code, decimals } = SALE_ASSETS[asset];
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (match === null) {
    return {
      ok: false,
      problem: `Write the price as a number in ${code}, such as 25.${"0".repeat(decimals)}, with a dot before any decimals.`,
    };
  }
  const whole = match[1] ?? "0";
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) {
    return { ok: false, problem: `${code} prices have at most ${decimals} decimal places.` };
  }
  const minor = BigInt(whole + fraction.padEnd(decimals, "0"));
  if (minor <= 0n) {
    return { ok: false, problem: "A price is more than zero." };
  }
  if (minor > MAX_MINOR) {
    return { ok: false, problem: "That price is too large." };
  }
  return { ok: true, minor: Number(minor) };
}

/** An amount of minor units in major units, with the asset's precision: `4500050` COPM/2 is `45000.50 COPM`. */
export function formatMinor(minor: number, asset: SaleAsset, withCode = true): string {
  const { code, decimals } = SALE_ASSETS[asset];
  const digits = BigInt(minor)
    .toString()
    .padStart(decimals + 1, "0");
  const major =
    decimals === 0
      ? digits
      : `${digits.slice(0, digits.length - decimals)}.${digits.slice(digits.length - decimals)}`;
  return withCode ? `${major} ${code}` : major;
}
