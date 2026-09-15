import { expect, type Page } from "@playwright/test";
import { mutate, query } from "./organiser";

interface Waited {
  readonly reached: boolean;
  readonly freshness: { readonly records: number };
}

function randomZoneId(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
}

/**
 * Writes one ledger record — a zone added — and answers how many records Kippu's
 * derived copy reflects once it has read that write. Between two such marks, the
 * difference counts every ledger record written in between, plus the mark itself.
 */
export async function ledgerRecordsAtMark(page: Page, event: string): Promise<number> {
  const { cursor } = await mutate<{ cursor: string }>(page, "events.zones.add", {
    event,
    zone: { id: randomZoneId(), kind: "Unseated" },
  });
  const waited = await query<Waited>(page, "derived.waitFor", { cursor, timeout: 10_000 });
  expect(waited.reached).toBe(true);
  return waited.freshness.records;
}
