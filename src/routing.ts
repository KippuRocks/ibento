import { useMemo, useSyncExternalStore } from "react";

/** Where the console is. Routes live in the URL's fragment, so the SPA needs no server rewrites. */
export type Route =
  | { readonly name: "events" }
  | { readonly name: "new-event" }
  | { readonly name: "event"; readonly event: string }
  | { readonly name: "edit-event"; readonly event: string };

const EVENT_PATH = /^\/events\/([0-9a-f]{64})(\/edit)?$/;

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "");
  if (path === "/events/new") {
    return { name: "new-event" };
  }
  const match = EVENT_PATH.exec(path);
  const event = match?.[1];
  if (event !== undefined) {
    return match?.[2] === undefined ? { name: "event", event } : { name: "edit-event", event };
  }
  return { name: "events" };
}

export function hrefOf(route: Route): string {
  switch (route.name) {
    case "events":
      return "#/events";
    case "new-event":
      return "#/events/new";
    case "event":
      return `#/events/${route.event}`;
    case "edit-event":
      return `#/events/${route.event}/edit`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefOf(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => parseRoute(hash), [hash]);
}
