import type { EventPassWindow } from "@kippu/api";

export type { EventPassWindow };

const MS_PER_SECOND = 1000;

/** Milliseconds as whole seconds, for display; a bound not on a whole second is shown to the millisecond. */
export function secondsOf(ms: number): string {
  return ms % MS_PER_SECOND === 0 ? String(ms / MS_PER_SECOND) : (ms / MS_PER_SECOND).toFixed(3);
}

export type WindowCheck =
  | { readonly ok: true; readonly windowMs: number }
  | { readonly ok: false; readonly problem: string };

/**
 * A pass window written in whole seconds, as milliseconds, checked against the
 * bounds kippu-api reports for the event — never bounds of the console's own.
 */
export function parseWindowSeconds(
  text: string,
  bounds: Pick<EventPassWindow, "minimumMs" | "maximumMs">,
): WindowCheck {
  const range = `between ${secondsOf(bounds.minimumMs)} and ${secondsOf(bounds.maximumMs)} seconds`;
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, problem: `Write the pass window as a whole number of seconds, ${range}.` };
  }
  const seconds = Number(trimmed);
  const windowMs = seconds * MS_PER_SECOND;
  if (
    !Number.isSafeInteger(windowMs) ||
    windowMs < bounds.minimumMs ||
    windowMs > bounds.maximumMs
  ) {
    return { ok: false, problem: `The pass window is ${range}.` };
  }
  return { ok: true, windowMs };
}
