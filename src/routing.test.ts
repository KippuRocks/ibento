import { describe, expect, it } from "vitest";
import { hrefOf, parseRoute, type Route } from "./routing";

const EVENT = "0f".repeat(32);

describe("routes", () => {
  it("round-trips every route through its fragment", () => {
    const routes: Route[] = [
      { name: "events" },
      { name: "new-event" },
      { name: "event", event: EVENT },
      { name: "edit-event", event: EVENT },
    ];
    for (const route of routes) {
      expect(parseRoute(hrefOf(route))).toEqual(route);
    }
  });

  it("falls back to the events list", () => {
    expect(parseRoute("#/events/not-an-id")).toEqual({ name: "events" });
    expect(parseRoute("")).toEqual({ name: "events" });
  });
});
