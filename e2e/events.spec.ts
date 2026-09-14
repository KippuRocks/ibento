import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { query, signUpOrganiser } from "./support/organiser";

interface EventView {
  readonly id: string;
  readonly owner: string;
  readonly status: string;
  readonly maxCapacity: number | null;
  readonly zones: readonly { readonly id: string; readonly kind: string }[];
  readonly metadata: { readonly name?: string } | null;
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
});

test("AC-A1.1 an organiser creates an event, which exists on the ledger with them as owner and status Active", async ({
  page,
}) => {
  await signUpOrganiser(page);

  await page.getByRole("link", { name: "New event" }).click();

  // Details: the public document.
  await page.getByLabel("Event name").fill("Autumn Gala");
  await page.getByLabel("Description").fill("An evening of music.");
  await page.getByLabel("Venue name").fill("Teatro Real");
  await page.getByLabel("Country code").fill("es");
  await page.getByRole("button", { name: "Add a session" }).click();
  await page.getByLabel("Session 1 starts").fill("2026-10-01T20:00");
  await page.getByRole("button", { name: "Next" }).click();

  // Zones: one general admission, one seated with its canonical positions.
  await page.getByRole("button", { name: "Add a zone" }).click();
  await page.getByLabel("Zone 1 name").fill("Standing");
  await page.getByRole("button", { name: "Add a zone" }).click();
  await page.getByLabel("Zone 2 name").fill("Stalls");
  await page.getByLabel("Zone 2 kind").selectOption("Seated");
  await page.getByLabel("Zone 2 seat positions").fill("A-1\nA-2\nA-3\n");
  await expect(page.getByText("3 seat positions")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // Capacity.
  await page.getByLabel("Limit capacity").check();
  await page.getByLabel("Capacity", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Create event" }).click();

  await expect(page.getByRole("heading", { name: "Autumn Gala" })).toBeVisible();
  await expect(page.getByTestId("event-status")).toHaveText("Active");
  await expect(page.getByRole("row", { name: /Stalls Seated 3 seat positions/ })).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Standing Unseated General admission/ }),
  ).toBeVisible();

  const eventId = new URL(page.url()).hash.replace("#/events/", "");

  // The ledger's facts, as the API reads them: the organiser's own events are those their
  // ledger account owns, and this is one of them, Active.
  const mine = await query<{ events: readonly EventView[] }>(page, "derived.events.mine");
  const created = mine.events.find((event) => event.id === eventId);
  expect(created?.status).toBe("Active");
  expect(created?.maxCapacity).toBe(500);
  expect(created?.zones.map((zone) => zone.kind).sort()).toEqual(["Seated", "Unseated"]);
  const read = await query<{ event: EventView }>(page, "derived.events.get", { event: eventId });
  expect(read.event.owner).toBe(created?.owner);
  await expect(page.getByTestId("event-owner")).toHaveText(read.event.owner);

  await page.getByRole("link", { name: "Your events" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Autumn Gala" })).toContainText(
    "Active",
  );
});

test("the wizard refuses details that would not make a valid document", async ({ page }) => {
  await signUpOrganiser(page);
  await page.getByRole("link", { name: "New event" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("alert")).toContainText("Give the event a name.");
});
