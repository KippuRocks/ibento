/**
 * The organiser's Kippu session, kept for the browser tab.
 *
 * The token is an opaque bearer token issued by kippu-api. It authorises calls
 * to the Kippu API only: it is not a ledger credential and cannot sign anything.
 * Tab-scoped storage means closing the tab ends Ibento's hold on it.
 */
export interface StoredSession {
  readonly token: string;
  /** ISO 8601. */
  readonly expiresAt: string;
  readonly organiser: { readonly id: string; readonly email: string };
}

export interface SessionStore {
  /** The stored session, or `null` when there is none or it has expired. */
  read(): StoredSession | null;
  write(session: StoredSession): void;
  clear(): void;
}

export type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "ibento.session";

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { token, expiresAt, organiser } = value as Record<string, unknown>;
  if (typeof token !== "string" || typeof expiresAt !== "string") {
    return false;
  }
  if (typeof organiser !== "object" || organiser === null) {
    return false;
  }
  const { id, email } = organiser as Record<string, unknown>;
  return typeof id === "string" && typeof email === "string";
}

export function createSessionStore(
  storage: SessionStorage,
  now: () => number = Date.now,
): SessionStore {
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
      if (!isStoredSession(parsed)) {
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
