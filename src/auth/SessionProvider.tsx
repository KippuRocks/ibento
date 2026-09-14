import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { OrganiserSession } from "./passkey";
import type { SessionStore, StoredSession } from "./session";

interface SessionContextValue {
  readonly session: StoredSession | null;
  signedIn(result: OrganiserSession): void;
  signedOut(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ store, children }: { store: SessionStore; children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => store.read());

  const signedIn = useCallback(
    ({ session: issued, organiser }: OrganiserSession) => {
      const stored: StoredSession = {
        token: issued.token,
        expiresAt: issued.expiresAt,
        organiser: { id: organiser.id, email: organiser.email },
      };
      store.write(stored);
      setSession(stored);
    },
    [store],
  );

  const signedOut = useCallback(() => {
    store.clear();
    setSession(null);
  }, [store]);

  const value = useMemo(() => ({ session, signedIn, signedOut }), [session, signedIn, signedOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession must be used inside a SessionProvider");
  }
  return value;
}
