// Reads the navigation declared in Ibento's sources: every edge from one screen to
// another, and every navigation that does not declare its edge.
//
// An edge is declared by one of three forms, each naming both ends literally:
//
//   <ScreenLink from="events.list" to="event.detail" params={…}>   a link
//   navigate("event.edit", "event.detail", { event })              navigation from code
//   transition("event.create.details", "event.create.zones")       a change of screen
//                                                                  the router does not make
//
// `from` may be a chrome, written `chrome:<id>`: its edges belong to every screen shown
// inside that chrome. Anything else that navigates — an `<a href>`, a write to
// `location`, `hrefOf` outside the screens module — is reported, so no transition
// escapes the manifest.

import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { parseSync } from "oxc-parser";

export interface Edge {
  readonly from: string;
  readonly to: string;
  readonly file: string;
  readonly line: number;
}

export interface Problem {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

export interface Extracted {
  readonly edges: readonly Edge[];
  readonly problems: readonly Problem[];
}

interface Node {
  readonly type: string;
  readonly start: number;
  readonly [key: string]: unknown;
}

const DECLARING_CALLS = new Set(["navigate", "transition"]);

/** The module that implements navigation, and may therefore use its primitives. */
const SCREENS_MODULE = /^src\/screens\//;

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

function children(node: Node): Node[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === "parent") return [];
    if (Array.isArray(value)) return value.filter(isNode);
    return isNode(value) ? [value] : [];
  });
}

function stringLiteral(node: unknown): string | null {
  if (!isNode(node)) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "JSXExpressionContainer") return stringLiteral(node.expression);
  return null;
}

function jsxName(node: Node): string | null {
  const name = node.name as Node | undefined;
  return name?.type === "JSXIdentifier" ? (name.name as string) : null;
}

function attribute(opening: Node, name: string): Node | null {
  const attributes = (opening.attributes as Node[] | undefined) ?? [];
  return (
    attributes.find((entry) => entry.type === "JSXAttribute" && jsxName(entry) === name) ?? null
  );
}

function lineOf(content: string, offset: number): number {
  return content.slice(0, offset).split("\n").length;
}

/** Edges and problems in one source file. `file` is relative to the repository root. */
export function extractFile(file: string, content: string): Extracted {
  const edges: Edge[] = [];
  const problems: Problem[] = [];
  const result = parseSync(file, content);
  for (const error of result.errors) {
    problems.push({ file, line: 1, message: `cannot parse: ${error.message}` });
  }
  const insideScreens = SCREENS_MODULE.test(file);

  const visit = (node: Node) => {
    const line = lineOf(content, node.start);
    if (node.type === "JSXOpeningElement") {
      const name = jsxName(node);
      if (name === "ScreenLink") {
        const from = stringLiteral(attribute(node, "from")?.value);
        const to = stringLiteral(attribute(node, "to")?.value);
        if (from === null || to === null) {
          problems.push({
            file,
            line,
            message: "ScreenLink must name `from` and `to` as string literals",
          });
        } else {
          edges.push({ from, to, file, line });
        }
      } else if (name === "a" && attribute(node, "href") !== null && !insideScreens) {
        problems.push({
          file,
          line,
          message: "navigate with ScreenLink, not <a href>, so the edge is declared",
        });
      }
    }
    if (node.type === "CallExpression") {
      const callee = node.callee as Node;
      const name = callee.type === "Identifier" ? (callee.name as string) : null;
      if (name !== null && DECLARING_CALLS.has(name) && !insideScreens) {
        const [from, to] = (node.arguments as Node[]).map(stringLiteral);
        if (from === null || from === undefined || to === null || to === undefined) {
          problems.push({
            file,
            line,
            message: `${name} must name both screens as string literals`,
          });
        } else {
          edges.push({ from, to, file, line });
        }
      }
      if (name === "hrefOf" && !insideScreens) {
        problems.push({
          file,
          line,
          message: "hrefOf is for the screens module; use ScreenLink or navigate",
        });
      }
    }
    if (node.type === "MemberExpression" && !insideScreens) {
      const property = node.property as Node;
      if (
        property.type === "Identifier" &&
        (property.name === "location" || property.name === "history")
      ) {
        problems.push({
          file,
          line,
          message: `window.${property.name as string} is for the screens module; use navigate`,
        });
      }
    }
    for (const child of children(node)) visit(child);
  };
  visit(result.program as unknown as Node);
  return { edges, problems };
}

function sourceFiles(root: string, directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(root, path);
    if (![".ts", ".tsx"].includes(extname(entry.name)) || /\.test\.tsx?$/.test(entry.name))
      return [];
    return [path];
  });
}

/** Edges and problems across every source file under `directory`. */
export function extract(root: string, directory = "src"): Extracted {
  const edges: Edge[] = [];
  const problems: Problem[] = [];
  for (const path of sourceFiles(root, directory).sort()) {
    const file = relative(root, join(root, path)).split("\\").join("/");
    const found = extractFile(file, readFileSync(join(root, path), "utf8"));
    edges.push(...found.edges);
    problems.push(...found.problems);
  }
  return { edges, problems };
}
