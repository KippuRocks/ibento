/**
 * A reviewer's Kippu session, kept for the browser tab (`T-021-16`; `F-021` plan
 * §5.4, "Reviewers"). Reviewer sessions are their own kind, never an organiser's,
 * and are kept under their own storage key so the two are never confused.
 */
export interface StoredReviewerSession {
  readonly token: string;
  /** ISO 8601. */
  readonly expiresAt: string;
  readonly reviewer: { readonly id: string; readonly email: string };
}

export interface ReviewerSessionStore {
  /** The stored session, or `null` when there is none or it has expired. */
  read(): StoredReviewerSession | null;
  write(session: StoredReviewerSession): void;
  clear(): void;
}

export type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "ibento.reviewer-session";

function isStoredReviewerSession(value: unknown): value is StoredReviewerSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { token, expiresAt, reviewer } = value as Record<string, unknown>;
  if (typeof token !== "string" || typeof expiresAt !== "string") {
    return false;
  }
  if (typeof reviewer !== "object" || reviewer === null) {
    return false;
  }
  const { id, email } = reviewer as Record<string, unknown>;
  return typeof id === "string" && typeof email === "string";
}

export function createReviewerSessionStore(
  storage: SessionStorage,
  now: () => number = Date.now,
): ReviewerSessionStore {
  function clear(): void {
    storage.removeItem(KEY);
  }

  return {
    read() {
      const raw = storage.getItem(KEY);
      if (raw === null) {
        return null;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        clear();
        return null;
      }
      if (!isStoredReviewerSession(parsed)) {
        clear();
        return null;
      }
      const expiresAt = Date.parse(parsed.expiresAt);
      if (Number.isNaN(expiresAt) || expiresAt <= now()) {
        clear();
        return null;
      }
      return parsed;
    },
    write(session) {
      storage.setItem(KEY, JSON.stringify(session));
    },
    clear,
  };
}
