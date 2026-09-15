import { ReviewerConsole } from "./ReviewerConsole";
import { useReviewerSession } from "./ReviewerSessionProvider";
import { ReviewerSignIn } from "./ReviewerSignIn";

/** Kippu's internal operations portal: a separate area from the organiser console. */
export function ReviewerApp() {
  const { session } = useReviewerSession();
  return (
    <main>{session === null ? <ReviewerSignIn /> : <ReviewerConsole session={session} />}</main>
  );
}
