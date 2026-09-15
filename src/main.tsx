import { QueryClient } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { API_PATH, createKippuClient } from "./api/client";
import { createSessionStore } from "./auth/session";
import { Root } from "./Root";
import { createReviewerSessionStore } from "./reviewer/session";
import "./styles.css";

// The organiser console and the reviewer portal (`Root`) each keep their own session,
// under their own storage key, their own tRPC client and their own query cache: the
// two name some of the same procedures (`auth.session.current` among them), and a
// shared cache would let one area's query answer from the other's stale result.
const sessions = createSessionStore(window.sessionStorage);
const kippu = createKippuClient(API_PATH, () => sessions.read()?.token ?? null);
const organiserQueryClient = new QueryClient();

const reviewerSessions = createReviewerSessionStore(window.sessionStorage);
const reviewerKippu = createKippuClient(API_PATH, () => reviewerSessions.read()?.token ?? null);
const reviewerQueryClient = new QueryClient();

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root element");
}

createRoot(root).render(
  <StrictMode>
    <Root
      organiser={{ client: kippu, sessions, queryClient: organiserQueryClient }}
      reviewer={{
        client: reviewerKippu,
        sessions: reviewerSessions,
        queryClient: reviewerQueryClient,
      }}
    />
  </StrictMode>,
);
