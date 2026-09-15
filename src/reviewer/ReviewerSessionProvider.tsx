import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { ReviewerSessionResult } from "./passkey";
import type { ReviewerSessionStore, StoredReviewerSession } from "./session";

interface ReviewerSessionContextValue {
  readonly session: StoredReviewerSession | null;
  signedIn(result: ReviewerSessionResult): void;
  signedOut(): void;
}

const ReviewerSessionContext = createContext<ReviewerSessionContextValue | null>(null);

export function ReviewerSessionProvider({
  store,
  children,
}: {
  store: ReviewerSessionStore;
  children: ReactNode;
}) {
  const [session, setSession] = useState<StoredReviewerSession | null>(() => store.read());

  const signedIn = useCallback(
    ({ session: issued, reviewer }: ReviewerSessionResult) => {
      const stored: StoredReviewerSession = {
        token: issued.token,
        expiresAt: issued.expiresAt,
        reviewer: { id: reviewer.id, email: reviewer.email },
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
  return <ReviewerSessionContext value={value}>{children}</ReviewerSessionContext>;
}

export function useReviewerSession(): ReviewerSessionContextValue {
  const value = useContext(ReviewerSessionContext);
  if (value === null) {
    throw new Error("useReviewerSession must be used inside a ReviewerSessionProvider");
  }
  return value;
}
