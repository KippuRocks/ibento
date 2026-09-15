import type { AppRouter } from "@kippurocks/api";
import type { inferRouterOutputs } from "@trpc/server";

type Outputs = inferRouterOutputs<AppRouter>;

/** An event as Kippu's derived copy reads it: ledger facts joined with its document (`AC-A3.2`). */
export type EventView = NonNullable<Outputs["derived"]["events"]["get"]["event"]>;

/** The text at a path in a metadata document; `null` when there is none. */
export function documentText(
  document: EventView["metadata"],
  ...path: readonly string[]
): string | null {
  let value: unknown = document;
  for (const key of path) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === "string" ? value : null;
}

/** How the console names an event: its document's name, or its identifier when it has none. */
export function eventName(event: EventView): string {
  return documentText(event.metadata, "name") ?? `Event ${event.id.slice(0, 12)}…`;
}
