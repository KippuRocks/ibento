import { useSession } from "./auth/SessionProvider";
import { SignIn } from "./auth/SignIn";
import { Console } from "./Console";

export function App() {
  const { session } = useSession();
  return <main>{session === null ? <SignIn /> : <Console session={session} />}</main>;
}
