import { describe, expect, it } from "vitest";
import { extractFile } from "./extract.ts";
import { buildManifest } from "./manifest.ts";

const registry = {
  "a.list": { title: "List", route: "#/a", chrome: "shell" },
  "a.detail": { title: "Detail", route: "#/a/:id", chrome: "shell" },
  "b.step.one": { title: "One", route: "#/b", chrome: null },
  "b.step.two": { title: "Two", route: "#/b", chrome: null },
};
const chrome = { shell: {} };

describe("the screen manifest", () => {
  it("records links, navigation from code and declared transitions as edges", () => {
    const extracted = extractFile(
      "src/example.tsx",
      `
        const link = <ScreenLink from="a.list" to="a.detail" params={{ id }}>Open</ScreenLink>;
        function saved() { navigate("a.detail", "a.list", {}); }
        const NEXT = { one: transition("b.step.one", "b.step.two") };
        const home = <ScreenLink from="chrome:shell" to="a.list" params={{}}>Home</ScreenLink>;
      `,
    );
    expect(extracted.problems).toEqual([]);
    const { manifest, problems } = buildManifest(extracted, registry, chrome);
    expect(problems).toEqual([]);
    expect(manifest).toEqual({
      format: "kippu.screens/1",
      app: "ibento",
      platform: "web",
      screens: [
        { screenId: "a.list", route: "#/a", title: "List", navigatesTo: ["a.detail"] },
        { screenId: "a.detail", route: "#/a/:id", title: "Detail", navigatesTo: ["a.list"] },
        { screenId: "b.step.one", route: "#/b", title: "One", navigatesTo: ["b.step.two"] },
        { screenId: "b.step.two", route: "#/b", title: "Two", navigatesTo: [] },
      ],
    });
  });

  it("reports navigation that does not declare its edge", () => {
    const { problems } = extractFile(
      "src/example.tsx",
      `
        const raw = <a href="#/a">List</a>;
        const computed = <ScreenLink from={here} to="a.list" params={{}}>List</ScreenLink>;
        navigate(where, "a.list", {});
        window.location.hash = "#/a";
        const url = hrefOf("a.list", {});
      `,
    );
    expect(problems.map(({ line, message }) => `${line}: ${message.split(" ")[0]}`)).toEqual([
      "2: navigate",
      "3: ScreenLink",
      "4: navigate",
      "5: window.location",
      "6: hrefOf",
    ]);
  });

  it("lets the screens module use the primitives it implements", () => {
    const { problems } = extractFile(
      "src/screens/router.ts",
      "export function navigate(from, to, params) { window.location.hash = hrefOf(to, params); }",
    );
    expect(problems).toEqual([]);
  });

  it("records an edge to another app's screen it declares, and refuses one it does not", () => {
    const extracted = extractFile(
      "src/x.ts",
      `transition("a.detail", "saifu:invitation.redeem"); transition("a.list", "saifu:gone");`,
    );
    const { manifest, problems } = buildManifest(extracted, registry, chrome, [
      "saifu:invitation.redeem",
    ]);
    expect(manifest.screens.find((screen) => screen.screenId === "a.detail")?.navigatesTo).toEqual([
      "saifu:invitation.redeem",
    ]);
    expect(problems.map(({ message }) => message)).toEqual(['unknown to screen "saifu:gone"']);
  });

  it("reports an edge to a screen the router does not have", () => {
    const extracted = extractFile("src/x.ts", `transition("a.list", "a.gone");`);
    const { problems } = buildManifest(extracted, registry, chrome);
    expect(problems.map(({ message }) => message)).toEqual(['unknown to screen "a.gone"']);
  });
});
