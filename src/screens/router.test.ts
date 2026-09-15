import { describe, expect, it } from "vitest";
import { SCREENS, type ScreenId } from "./registry";
import { hrefOf, parseLocation } from "./router";

const EVENT = "0f".repeat(32);

describe("the router", () => {
  it("resolves each route to the first screen declared for it", () => {
    expect(parseLocation("#/events")).toEqual({ screen: "events.list", params: {} });
    expect(parseLocation("#/events/new")).toEqual({ screen: "event.create.details", params: {} });
    expect(parseLocation(`#/events/${EVENT}`)).toEqual({
      screen: "event.detail",
      params: { event: EVENT },
    });
    expect(parseLocation(`#/events/${EVENT}/edit`)).toEqual({
      screen: "event.edit",
      params: { event: EVENT },
    });
  });

  it("round-trips every screen that has a route through its URL", () => {
    for (const [id, screen] of Object.entries(SCREENS) as [ScreenId, { route: string | null }][]) {
      if (
        screen.route === null ||
        parseLocation(screen.route.replace(":event", EVENT)).screen !== id
      ) {
        continue;
      }
      const href = hrefOf(id as "event.detail", { event: EVENT });
      expect(parseLocation(href).screen).toBe(id);
    }
  });

  it("sends a URL that names no screen to the events list", () => {
    expect(parseLocation("#/events/not-an-id").screen).toBe("events.list");
    expect(parseLocation("").screen).toBe("events.list");
  });

  it("refuses to build a URL without its parameters", () => {
    expect(() => hrefOf("event.detail", {} as { event: string })).toThrow(/event/);
  });
});
