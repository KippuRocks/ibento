/**
 * Ibento's screens: the router's table (`F-070` plan §5.4).
 *
 * Every screen has a stable `screenId`, the route it is shown at, and a title.
 * The router resolves a URL to the first screen declared for its route, so a
 * multi-step flow declares its first step first. A screen whose route is `null`
 * has no URL of its own: the signed-out screens are shown at whatever URL was
 * asked for.
 *
 * Screen ids name what the screen is for, as `area.subject.step`. They never
 * name copy, positions or indices, so copy can change without breaking them.
 * An id, once used, is not renamed: journeys, screenshots and the navigation map
 * in `kippu-e2e` refer to it.
 *
 * `tools/screens` reads this table, and the navigation declared in the sources,
 * to generate `screens.json`. This module imports nothing, so the tool can load
 * it without the app.
 */

export interface ScreenDefinition {
  readonly title: string;
  /** A hash route, such as `#/events/:event`; `null` for a screen with no URL of its own. */
  readonly route: string | null;
  /** The chrome the screen is shown inside, whose navigation every such screen has. */
  readonly chrome: ChromeId | null;
}

/** Navigation shared by every screen shown inside it, such as the console's header. */
export const CHROME = {
  console: { title: "Console header" },
  reviewer: { title: "Reviewer console header" },
} as const;

export type ChromeId = keyof typeof CHROME;

export const SCREENS = {
  "auth.sign-in": { title: "Sign in", route: null, chrome: null },
  "auth.sign-up": { title: "Create an organiser account", route: null, chrome: null },
  "auth.unsupported": { title: "Passkeys unsupported", route: null, chrome: null },
  "events.list": { title: "Your events", route: "#/events", chrome: "console" },
  "event.create.details": { title: "New event: details", route: "#/events/new", chrome: "console" },
  "event.create.zones": { title: "New event: zones", route: "#/events/new", chrome: "console" },
  "event.create.capacity": {
    title: "New event: capacity and sale",
    route: "#/events/new",
    chrome: "console",
  },
  "event.create.review": { title: "New event: review", route: "#/events/new", chrome: "console" },
  "event.detail": { title: "Event", route: "#/events/:event", chrome: "console" },
  "event.edit": { title: "Edit event", route: "#/events/:event/edit", chrome: "console" },
  "event.guests": { title: "Guest list", route: "#/events/:event/guests", chrome: "console" },
  "event.guests.link": {
    title: "Invitation link",
    route: "#/events/:event/guests",
    chrome: "console",
  },
  "event.operators": {
    title: "Gate access",
    route: "#/events/:event/operators",
    chrome: "console",
  },
  "event.flags": {
    title: "Admission flags",
    route: "#/events/:event/flags",
    chrome: "console",
  },
  "operators.list": { title: "Operators", route: "#/operators", chrome: "console" },
  "operators.enrolment-code": {
    title: "Enrolment code",
    route: "#/operators",
    chrome: "console",
  },
  "reviewer.sign-in": { title: "Reviewer sign-in", route: null, chrome: null },
  "reviewer.enrol": { title: "Redeem an enrolment code", route: null, chrome: null },
  "reviewers.queue": {
    title: "Capacity proof review queue",
    route: "#/reviewer/queue",
    chrome: "reviewer",
  },
} as const satisfies Readonly<Record<string, ScreenDefinition>>;

export type ScreenId = keyof typeof SCREENS;

/**
 * Screens of other Kippu apps that Ibento's screens lead to, written
 * `<app>:<screenId>` with the id that app's own manifest gives the screen. A
 * transition to one is an edge between apps in `kippu-e2e`'s navigation map.
 */
export const EXTERNAL_SCREENS = ["saifu:invitation.redeem"] as const;

export type ExternalScreenId = (typeof EXTERNAL_SCREENS)[number];

/** Where the router sends a URL that names no screen. */
export const FALLBACK_SCREEN = "events.list" satisfies ScreenId;
