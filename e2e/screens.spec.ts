import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { organiserEmail } from "./support/organiser";

interface ManifestScreen {
  readonly screenId: string;
  readonly route: string | null;
  readonly title: string;
  readonly navigatesTo: readonly string[];
}

const manifest = JSON.parse(readFileSync("screens.json", "utf8")) as {
  readonly screens: readonly ManifestScreen[];
};
const byId = new Map(manifest.screens.map((screen) => [screen.screenId, screen]));

/**
 * Follows the console through its screens, checking at every step that exactly
 * one screen id is rendered, that it is the expected one and is in the manifest,
 * and that the transition taken is one the manifest declares.
 */
class Walk {
  readonly visited = new Set<string>();
  private current: string | null = null;

  constructor(private readonly page: Page) {}

  async on(screenId: string): Promise<void> {
    const screen = byId.get(screenId);
    expect(screen, `${screenId} is in screens.json`).toBeDefined();
    await expect(this.page.locator(`[data-screen="${screenId}"]`)).toBeVisible();
    await expect(this.page.locator("[data-screen]")).toHaveCount(1);
    await expect(this.page).toHaveTitle(`${screen?.title} · Ibento`);
    if (this.current !== null && this.current !== screenId) {
      expect(byId.get(this.current)?.navigatesTo, `${this.current} → ${screenId}`).toContain(
        screenId,
      );
    }
    this.current = screenId;
    this.visited.add(screenId);
  }
}

test("every screen in screens.json renders its data-screen id, reached along declared transitions", async ({
  page,
  browser,
}) => {
  await addVirtualAuthenticator(page);
  const walk = new Walk(page);

  await page.goto("/");
  await walk.on("auth.sign-in");
  await page.getByRole("button", { name: "Create an organiser account" }).click();
  await walk.on("auth.sign-up");
  await page.getByRole("button", { name: "I already have an account" }).click();
  await walk.on("auth.sign-in");
  await page.getByRole("button", { name: "Create an organiser account" }).click();
  await walk.on("auth.sign-up");
  await page.getByLabel("Email").fill(organiserEmail());
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await walk.on("events.list");

  await page.getByRole("link", { name: "New event" }).click();
  await walk.on("event.create.details");
  await page.getByLabel("Event name").fill("Screen Walk");
  await page.getByRole("button", { name: "Next" }).click();
  await walk.on("event.create.zones");
  await page.getByRole("button", { name: "Back" }).click();
  await walk.on("event.create.details");
  await page.getByRole("button", { name: "Next" }).click();
  await walk.on("event.create.zones");
  await page.getByRole("button", { name: "Add a zone" }).click();
  await page.getByLabel("Zone 1 name").fill("Standing");
  await page.getByRole("button", { name: "Next" }).click();
  await walk.on("event.create.capacity");
  await page.getByRole("button", { name: "Back" }).click();
  await walk.on("event.create.zones");
  await page.getByRole("button", { name: "Next" }).click();
  await walk.on("event.create.capacity");
  await page.getByRole("button", { name: "Next" }).click();
  await walk.on("event.create.review");
  await page.getByRole("button", { name: "Back" }).click();
  await walk.on("event.create.capacity");
  await page.getByRole("button", { name: "Next" }).click();
  await walk.on("event.create.review");
  await page.getByRole("button", { name: "Create event" }).click();
  await walk.on("event.detail");

  await page.getByRole("link", { name: "Edit details" }).click();
  await walk.on("event.edit");
  await page.getByRole("link", { name: "Cancel" }).click();
  await walk.on("event.detail");
  await page.getByRole("link", { name: "Edit details" }).click();
  await walk.on("event.edit");
  await page.getByRole("button", { name: "Save changes" }).click();
  await walk.on("event.detail");

  const classForm = page.getByRole("form", { name: "Define a class" });
  await classForm.getByLabel("Class name").fill("Guests");
  await classForm.getByRole("button", { name: "Define class" }).click();
  await expect(page.getByRole("status")).toHaveText("Defined the class Guests.");
  await page.getByRole("link", { name: "Guest list" }).click();
  await walk.on("event.guests");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await walk.on("event.guests.link");
  await page.getByRole("button", { name: "Done" }).click();
  await walk.on("event.guests");
  await page.getByRole("link", { name: "Back to the event" }).click();
  await walk.on("event.detail");

  await page.getByRole("link", { name: "Admission flags" }).click();
  await walk.on("event.flags");
  await page.getByRole("link", { name: "Back to the event" }).click();
  await walk.on("event.detail");
  await page.getByRole("link", { name: "Gate access" }).click();
  await walk.on("event.operators");
  await page.getByRole("link", { name: "operators page" }).click();
  await walk.on("operators.list");
  await page.getByLabel("Operator name").fill("Walker");
  await page.getByRole("button", { name: "Add operator" }).click();
  await page.getByRole("button", { name: "Issue enrolment code" }).click();
  await walk.on("operators.enrolment-code");
  await page.getByRole("button", { name: "Done" }).click();
  await walk.on("operators.list");

  await page.getByRole("link", { name: "Your events" }).click();
  await walk.on("events.list");
  await page.getByRole("link", { name: "Screen Walk" }).click();
  await walk.on("event.detail");
  await page.getByRole("button", { name: "Sign out" }).click();
  await walk.on("auth.sign-in");

  // A browser without passkeys.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Reflect.deleteProperty(window, "PublicKeyCredential");
  });
  const unsupported = await context.newPage();
  await unsupported.goto("/");
  const other = new Walk(unsupported);
  await other.on("auth.unsupported");
  await context.close();

  const visited = new Set([...walk.visited, ...other.visited]);
  expect(
    [...byId.keys()].filter((id) => !visited.has(id)),
    "screens no walk reached",
  ).toEqual([]);
});
