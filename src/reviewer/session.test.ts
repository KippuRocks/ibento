import { describe, expect, it } from "vitest";
import {
  createReviewerSessionStore,
  type SessionStorage,
  type StoredReviewerSession,
} from "./session";

function memoryStorage(): SessionStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

const NOW = Date.parse("2026-09-14T12:00:00Z");

const session: StoredReviewerSession = {
  token: "cmV2aWV3ZXItc2Vzc2lvbi10b2tlbg",
  expiresAt: "2026-09-15T00:00:00.000Z",
  reviewer: { id: "0b9e3f5e-4a64-4b8e-9d35-7f1a4a0c2e11", email: "reviewer@example.com" },
};

describe("the reviewer session store", () => {
  it("returns the session it was given until it expires", () => {
    const storage = memoryStorage();
    const store = createReviewerSessionStore(storage, () => NOW);
    store.write(session);
    expect(store.read()).toEqual(session);
  });

  it("forgets a session once kippu-api's expiry has passed", () => {
    const storage = memoryStorage();
    let now = NOW;
    const store = createReviewerSessionStore(storage, () => now);
    store.write(session);
    now = Date.parse(session.expiresAt);
    expect(store.read()).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("forgets what it cannot read as a session", () => {
    const storage = memoryStorage();
    const store = createReviewerSessionStore(storage, () => NOW);
    storage.setItem("ibento.reviewer-session", "{not json");
    expect(store.read()).toBeNull();
    storage.setItem("ibento.reviewer-session", JSON.stringify({ token: "t" }));
    expect(store.read()).toBeNull();
    expect(storage.items.size).toBe(0);
  });

  it("clears the session on sign-out", () => {
    const storage = memoryStorage();
    const store = createReviewerSessionStore(storage, () => NOW);
    store.write(session);
    store.clear();
    expect(store.read()).toBeNull();
  });

  it("is kept under its own key, distinct from the organiser session", () => {
    const storage = memoryStorage();
    const store = createReviewerSessionStore(storage, () => NOW);
    store.write(session);
    expect(storage.items.has("ibento.session")).toBe(false);
    expect(storage.items.has("ibento.reviewer-session")).toBe(true);
  });
});
