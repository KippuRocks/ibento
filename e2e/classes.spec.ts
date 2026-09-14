import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { query, signUpOrganiser } from "./support/organiser";

interface TicketClass {
  readonly name: string;
  readonly provenance: string;
  readonly policy: unknown;
  readonly restrictions: { readonly cannotResale: boolean; readonly cannotTransfer: boolean };
  readonly quota: number | null;
}

async function createEvent(page: Page, name: string): Promise<string> {
  await page.getByRole("link", { name: "New event" }).click();
  await page.getByLabel("Event name").fill(name);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Add a zone" }).click();
  await page.getByLabel("Zone 1 name").fill("Standing");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Active");
  return new URL(page.url()).hash.replace("#/events/", "");
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("AC-B2.1 an organiser defines classes, setting name, quota, policy and, for a granted class, restrictions", async ({
  page,
}) => {
  const event = await createEvent(page, "Press Night");
  const form = page.getByRole("form", { name: "Define a class" });

  // A granted class: restricted, with its own policy and quota.
  await form.getByLabel("Class name").fill("Press");
  await form.getByLabel("Granted — free tickets").check();
  await form.getByLabel("Admits", { exact: true }).selectOption("Multiple");
  await form.getByLabel("Maximum admissions").fill("2");
  await form.getByLabel("Cannot be transferred").check();
  await expect(form.getByLabel("Cannot be resold")).toBeChecked();
  await form.getByLabel("Class quota").fill("20");
  await form.getByRole("button", { name: "Define class" }).click();
  await expect(page.getByRole("status")).toHaveText("Defined the class Press.");

  // A second, independently configured class (REQ-TC-1).
  await form.getByLabel("Class name").fill("Artist guests");
  await form.getByLabel("Cannot be resold").check();
  await form.getByRole("button", { name: "Define class" }).click();
  await expect(page.getByRole("status")).toHaveText("Defined the class Artist guests.");

  await expect(
    page.getByRole("row", {
      name: "Press Granted Admits up to 2 times Cannot be transferred or resold 20",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "Artist guests Granted Admits once Cannot be resold None" }),
  ).toBeVisible();

  const classes = await query<readonly TicketClass[]>(page, "events.classes.list", { event });
  expect(
    classes.map(({ name, provenance, policy, restrictions, quota }) => ({
      name,
      provenance,
      policy,
      restrictions,
      quota,
    })),
  ).toEqual([
    {
      name: "Press",
      provenance: "Granted",
      policy: { kind: "Multiple", max: 2, until: null },
      restrictions: { cannotResale: true, cannotTransfer: true },
      quota: 20,
    },
    {
      name: "Artist guests",
      provenance: "Granted",
      policy: { kind: "Single" },
      restrictions: { cannotResale: true, cannotTransfer: false },
      quota: null,
    },
  ]);
});

test("REQ-TC-3 a Purchased class with a restriction cannot be submitted, and the form says why", async ({
  page,
}) => {
  const event = await createEvent(page, "General Sale");
  const form = page.getByRole("form", { name: "Define a class" });
  const defines: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("events.classes.define")) defines.push(request.url());
  });

  await form.getByLabel("Class name").fill("General admission");
  await form.getByLabel("Purchased — sold tickets").check();
  await expect(form.getByTestId("purchased-restrictions")).toHaveText(
    "A Purchased class cannot carry restrictions: a ticket someone paid for is always resellable and transferable.",
  );
  await form.getByLabel("Cannot be resold").check();
  await form.getByRole("button", { name: "Define class" }).click();

  await expect(form.getByRole("alert")).toContainText(
    "A Purchased class cannot carry restrictions",
  );
  expect(defines).toEqual([]);
  expect(await query<readonly TicketClass[]>(page, "events.classes.list", { event })).toEqual([]);

  // Without the restriction, the same class is defined.
  await form.getByLabel("Cannot be resold").uncheck();
  await form.getByRole("button", { name: "Define class" }).click();
  await expect(
    page.getByRole("row", {
      name: "General admission Purchased Admits once Transferable and resellable None",
    }),
  ).toBeVisible();
});
