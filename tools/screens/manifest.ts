// Builds `screens.json`: Ibento's screen manifest (F-070 plan §5.4).

import { CHROME, SCREENS } from "../../src/screens/registry.ts";
import type { Edge, Extracted, Problem } from "./extract.ts";

/** One screen of the manifest. */
export interface ManifestScreen {
  readonly screenId: string;
  /** The route the screen is shown at, as a URL fragment pattern; `null` when it has no URL of its own. */
  readonly route: string | null;
  readonly title: string;
  /** The screens this screen can navigate to, sorted. */
  readonly navigatesTo: readonly string[];
}

export interface Manifest {
  readonly format: "kippu.screens/1";
  readonly app: "ibento";
  readonly platform: "web";
  /** In the router's declaration order. */
  readonly screens: readonly ManifestScreen[];
}

type Registry = Readonly<
  Record<
    string,
    { readonly title: string; readonly route: string | null; readonly chrome: string | null }
  >
>;

export function buildManifest(
  extracted: Extracted,
  screens: Registry = SCREENS,
  chrome: Readonly<Record<string, unknown>> = CHROME,
): { manifest: Manifest; problems: readonly Problem[] } {
  const problems: Problem[] = [...extracted.problems];
  const targets = new Map<string, Set<string>>(Object.keys(screens).map((id) => [id, new Set()]));

  const known = (edge: Edge, end: "from" | "to"): boolean => {
    const id = edge[end];
    const isChrome = end === "from" && id.startsWith("chrome:") && id.slice(7) in chrome;
    if (!isChrome && !(id in screens)) {
      problems.push({ file: edge.file, line: edge.line, message: `unknown ${end} screen "${id}"` });
      return false;
    }
    return true;
  };

  for (const edge of extracted.edges) {
    if (!known(edge, "from") || !known(edge, "to")) continue;
    const sources = edge.from.startsWith("chrome:")
      ? Object.entries(screens)
          .filter(([, screen]) => screen.chrome === edge.from.slice(7))
          .map(([id]) => id)
      : [edge.from];
    for (const source of sources) {
      if (source !== edge.to) targets.get(source)?.add(edge.to);
    }
  }

  return {
    manifest: {
      format: "kippu.screens/1",
      app: "ibento",
      platform: "web",
      screens: Object.entries(screens).map(([screenId, screen]) => ({
        screenId,
        route: screen.route,
        title: screen.title,
        navigatesTo: [...(targets.get(screenId) ?? [])].sort(),
      })),
    },
    problems,
  };
}

export function serialise(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
