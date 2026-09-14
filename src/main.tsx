import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { API_PATH, createKippuClient, TRPCProvider } from "./api/client";
import { SessionProvider } from "./auth/SessionProvider";
import { createSessionStore } from "./auth/session";
import "./styles.css";

const sessions = createSessionStore(window.sessionStorage);
const queryClient = new QueryClient();
const kippu = createKippuClient(API_PATH, () => sessions.read()?.token ?? null);

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root element");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={kippu} queryClient={queryClient}>
        <SessionProvider store={sessions}>
          <App />
        </SessionProvider>
      </TRPCProvider>
    </QueryClientProvider>
  </StrictMode>,
);
