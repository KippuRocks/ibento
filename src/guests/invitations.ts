import type { AppRouter } from "@kippu/api";
import type { inferRouterOutputs } from "@trpc/server";

export type Invitation = inferRouterOutputs<AppRouter>["events"]["invitations"]["list"][number];

/**
 * Saifu's origin, which invitation links open (`T-030-10`): an https origin with
 * no path, set as `SAIFU_LINK_BASE` when the console is built. Saifu's host is
 * not chosen yet, so the default is a placeholder.
 */
export const PLACEHOLDER_SAIFU_LINK_BASE = "https://saifu.kippu.example";

/** Whether a value is what `SAIFU_LINK_BASE` must be: an https origin, with no path. */
export function isSaifuLinkBase(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  } catch {
    return false;
  }
}

/**
 * The link a guest follows to Saifu's invitation screen, in the format Saifu's
 * handoff defines: `<SAIFU_LINK_BASE>/invitations#<token>`. The token travels in
 * the fragment, which browsers never send to a server.
 */
export function invitationLink(token: string, base: string = PLACEHOLDER_SAIFU_LINK_BASE): string {
  if (!isSaifuLinkBase(base)) {
    throw new Error(`SAIFU_LINK_BASE must be an https origin with no path, not ${base}`);
  }
  return `${base}/invitations#${token}`;
}

/** Seat designations are compared as kippu-api stores them: in Unicode NFC. */
function sameSeat(a: string, b: string): boolean {
  return a.normalize("NFC") === b.normalize("NFC");
}

export type SeatConflict = "open" | "redeemed" | null;

/**
 * Whether a seat already has an invitation that a new one would compete with.
 * Two invitations may name one seat, but only one ticket can exist for it: the
 * second redemption is refused.
 */
export function seatConflict(
  invitations: readonly Invitation[],
  zone: string,
  position: string,
): SeatConflict {
  const forSeat = invitations.filter(
    (invitation) =>
      invitation.zone === zone &&
      invitation.placement.kind === "Seated" &&
      sameSeat(invitation.placement.position, position),
  );
  if (forSeat.some((invitation) => invitation.status === "redeemed")) {
    return "redeemed";
  }
  if (
    forSeat.some((invitation) => invitation.status === "open" || invitation.status === "redeeming")
  ) {
    return "open";
  }
  return null;
}

export function describeStatus(status: Invitation["status"]): string {
  switch (status) {
    case "open":
      return "Waiting for the guest";
    case "redeeming":
      return "Issuing the ticket";
    case "redeemed":
      return "Ticket issued";
    case "failed":
      return "Issuance did not finish; the ticket may exist";
  }
}
