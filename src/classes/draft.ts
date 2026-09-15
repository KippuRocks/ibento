import type { AppRouter } from "@kippu/api";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { parsePrice, type SaleAsset } from "../sales/money";

export type DefineClassInput = inferRouterInputs<AppRouter>["events"]["classes"]["define"];
export type TicketClass = inferRouterOutputs<AppRouter>["events"]["classes"]["list"][number];
export type Provenance = DefineClassInput["provenance"];
export type PolicyKind = DefineClassInput["policy"]["kind"];

/** A ticket class as the form holds it (`AC-B2.1`). */
export interface ClassDraft {
  readonly name: string;
  readonly description: string;
  readonly provenance: Provenance;
  readonly policy: PolicyKind;
  /** `Multiple` only: how many times a ticket admits. */
  readonly max: string;
  /** `Multiple` and `Unlimited`: until when, as a `datetime-local` input holds it; empty for no limit. */
  readonly until: string;
  readonly cannotResale: boolean;
  readonly cannotTransfer: boolean;
  /** Empty for no class quota. */
  readonly quota: string;
  /** `Purchased` only: in major units of the event's sale asset, as written. */
  readonly price: string;
}

export function emptyClass(): ClassDraft {
  return {
    name: "",
    description: "",
    provenance: "Granted",
    policy: "Single",
    max: "",
    until: "",
    cannotResale: false,
    cannotTransfer: false,
    quota: "",
    price: "",
  };
}

/** Why a `Purchased` class carries no restriction (`REQ-TC-3`, `REQ-TK-3`, `INV-12`). */
export const PURCHASED_RESTRICTION_REFUSAL =
  "A Purchased class cannot carry restrictions: a ticket someone paid for is always resellable and transferable.";

const WHOLE = /^\d+$/;

function whole(value: string): number | null {
  return WHOLE.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}

export type ClassCheck =
  | { readonly ok: true; readonly input: DefineClassInput }
  | { readonly ok: false; readonly problems: readonly string[] };

/**
 * The class definition a draft makes for an event, or what stops it.
 *
 * A `Purchased` class with a restriction is refused here, at definition, before
 * anything is sent (`REQ-TC-3`). `cannotTransfer` carries `cannotResale` with it
 * (`REQ-TK-2`), as the class's tickets will.
 */
export function checkClass(event: string, draft: ClassDraft, asset: SaleAsset | null): ClassCheck {
  const problems: string[] = [];
  const name = draft.name.trim();
  if (name === "") {
    problems.push("Give the class a name.");
  }
  const restricted = draft.cannotResale || draft.cannotTransfer;
  if (draft.provenance === "Purchased" && restricted) {
    problems.push(PURCHASED_RESTRICTION_REFUSAL);
  }
  const max = whole(draft.max);
  if (draft.policy === "Multiple" && max === null) {
    problems.push("Write how many times a ticket admits as a whole number.");
  }
  let until: number | null = null;
  if (draft.policy !== "Single" && draft.until !== "") {
    const time = new Date(draft.until).getTime();
    if (Number.isNaN(time) || time < 0) {
      problems.push("Write when tickets stop admitting as a date and time.");
    } else {
      until = time;
    }
  }
  const quota = draft.quota.trim() === "" ? null : whole(draft.quota.trim());
  if (draft.quota.trim() !== "" && quota === null) {
    problems.push("Write the quota as a whole number, or leave it empty for no class quota.");
  }
  let price: number | null = null;
  if (draft.provenance === "Purchased") {
    if (asset === null) {
      problems.push(
        "Choose the event's sale asset before defining a Purchased class: its price is in that asset.",
      );
    } else {
      const parsed = parsePrice(draft.price, asset);
      if (parsed.ok) {
        price = parsed.minor;
      } else {
        problems.push(parsed.problem);
      }
    }
  }
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  const policy: DefineClassInput["policy"] =
    draft.policy === "Single"
      ? { kind: "Single" }
      : draft.policy === "Multiple"
        ? { kind: "Multiple", max: max ?? 0, until }
        : { kind: "Unlimited", until };
  const description = draft.description.trim();
  return {
    ok: true,
    input: {
      event,
      name,
      description: description === "" ? null : description,
      provenance: draft.provenance,
      policy,
      restrictions: {
        cannotResale: draft.cannotResale || draft.cannotTransfer,
        cannotTransfer: draft.cannotTransfer,
      },
      quota,
      price,
    },
  };
}

/** How the console describes an attendance policy. */
export function describePolicy(policy: TicketClass["policy"]): string {
  const until =
    policy.kind !== "Single" && policy.until !== null
      ? `, until ${new Date(policy.until).toLocaleString()}`
      : "";
  switch (policy.kind) {
    case "Single":
      return "Admits once";
    case "Multiple":
      return `Admits up to ${policy.max} times${until}`;
    case "Unlimited":
      return `Admits any number of times${until}`;
  }
}

/** How the console describes a class's restrictions. */
export function describeRestrictions(restrictions: TicketClass["restrictions"]): string {
  if (restrictions.cannotTransfer) {
    return "Cannot be transferred or resold";
  }
  if (restrictions.cannotResale) {
    return "Cannot be resold";
  }
  return "Transferable and resellable";
}
