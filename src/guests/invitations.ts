import type { AppRouter } from "@kippu/api";
import type { inferRouterOutputs } from "@trpc/server";

export type Invitation = inferRouterOutputs<AppRouter>["events"]["invitations"]["list"][number];

/**
 * Where invitation links point until Saifu's handoff (`T-030-10`) defines their
 * format and host: a placeholder, replaced by setting `SAIFU_LINK_BASE` when
 * the console is built.
 */
export const PLACEHOLDER_SAIFU_LINK_BASE = "https://saifu.kippu.example/invitations/";

/** The link a guest follows to Saifu: the configured base, then the token. */
export function invitationLink(token: string, base: string = PLACEHOLDER_SAIFU_LINK_BASE): string {
  return `${base}${encodeURIComponent(token)}`;
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
