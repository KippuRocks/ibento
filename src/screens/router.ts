import { useMemo, useSyncExternalStore } from "react";
import {
  type ChromeId,
  type ExternalScreenId,
  FALLBACK_SCREEN,
  SCREENS,
  type ScreenId,
} from "./registry";

type RouteOf<Id extends ScreenId> = (typeof SCREENS)[Id]["route"];

type ParamNames<Route> = Route extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : Route extends `${string}:${infer Name}`
    ? Name
    : never;

/** The parameters a screen's route needs, such as `{ event }` for `#/events/:event`. */
export type ParamsOf<Id extends ScreenId> = { readonly [Name in ParamNames<RouteOf<Id>>]: string };

/** A screen that has a URL: the only kind a link or `navigate` can reach. */
export type RoutedScreenId = {
  [Id in ScreenId]: RouteOf<Id> extends string ? Id : never;
}[ScreenId];

export interface Location {
  readonly screen: RoutedScreenId;
  readonly params: Readonly<Record<string, string>>;
}

const HEX_64 = "[0-9a-f]{64}";

function patternOf(route: string): { regex: RegExp; names: string[] } {
  const names: string[] = [];
  const source = route
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        names.push(segment.slice(1));
        // Every parameter Ibento routes today is a 32-byte ledger identifier.
        return `(${HEX_64})`;
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${source}$`), names };
}

const ROUTED = (Object.entries(SCREENS) as [ScreenId, (typeof SCREENS)[ScreenId]][]).flatMap(
  ([id, screen]) =>
    screen.route === null ? [] : [{ id: id as RoutedScreenId, ...patternOf(screen.route) }],
);

/** The screen a URL fragment names: the first declared for its route. */
export function parseLocation(hash: string): Location {
  const fragment = hash.startsWith("#") ? hash : `#${hash}`;
  for (const { id, regex, names } of ROUTED) {
    const match = regex.exec(fragment);
    if (match !== null) {
      return {
        screen: id,
        params: Object.fromEntries(names.map((name, i) => [name, match[i + 1] ?? ""])),
      };
    }
  }
  return { screen: FALLBACK_SCREEN, params: {} };
}

/** A screen's URL fragment, with its parameters filled in. */
export function hrefOf<Id extends RoutedScreenId>(screen: Id, params: ParamsOf<Id>): string {
  const route = SCREENS[screen].route as string;
  return route.replace(/:([a-z]+)/g, (_, name: string) => {
    const value = (params as Record<string, string>)[name];
    if (value === undefined) {
      throw new Error(`${screen} needs the parameter ${name}`);
    }
    return value;
  });
}

/**
 * Declares a transition from one screen to another that the router does not
 * make: a step in a flow, a change of session, or a handoff to another app's
 * screen. It answers `to`, so it stands where the transition happens.
 * `tools/screens` reads every call, which must name both screens literally.
 */
export function transition<To extends ScreenId | ExternalScreenId>(
  _from: ScreenId | `chrome:${ChromeId}`,
  to: To,
): To {
  return to;
}

/**
 * Navigates to a screen from code, as after a mutation. `from` names the screen
 * the call is made on, literally, so `tools/screens` can record the edge.
 */
export function navigate<Id extends RoutedScreenId>(
  _from: ScreenId | `chrome:${ChromeId}`,
  to: Id,
  params: ParamsOf<Id>,
): void {
  window.location.hash = hrefOf(to, params);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useLocation(): Location {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => parseLocation(hash), [hash]);
}
