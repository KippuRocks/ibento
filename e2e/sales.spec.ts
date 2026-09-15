import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { signUpOrganiser } from "./support/organiser";

const API = "http://127.0.0.1:8080/v0/trpc";

interface SaleInventory {
  readonly event: string;
  readonly onSale: boolean;
  readonly asset: string | null;
  readonly classes: readonly {
    readonly id: string;
    readonly name: string;
    readonly price: number;
  }[];
}

/** What Ichiba reads of an event: public, with no session. */
async function inventory(page: Page, event: string): Promise<SaleInventory> {
  const response = await page.request.get(
    `${API}/sales.inventory?input=${encodeURIComponent(JSON.stringify({ event }))}`,
  );
  expect(response.ok()).toBe(true);
  return (await response.json()).result.data as SaleInventory;
}

async function createEvent(page: Page, name: string, saleAsset: string | null): Promise<string> {
  await page.getByRole("link", { name: "New event" }).click();
  await page.getByLabel("Event name").fill(name);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Add a zone" }).click();
  await page.getByLabel("Zone 1 name").fill("Standing");
  await page.getByRole("button", { name: "Next" }).click();
  if (saleAsset !== null) {
    await page.getByLabel("Sale asset").selectOption(saleAsset);
  }
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Active");
  return new URL(page.url()).hash.replace("#/events/", "");
}

async function definePurchasedClass(page: Page, name: string, price: string): Promise<void> {
  const form = page.getByRole("form", { name: "Define a class" });
  await form.getByLabel("Class name").fill(name);
  await form.getByLabel("Purchased — sold tickets").check();
  await form.getByLabel(/^Price/).fill(price);
  await form.getByRole("button", { name: "Define class" }).click();
  await expect(page.getByRole("status")).toHaveText(`Defined the class ${name}.`);
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("US-B4 an organiser sets the sale asset and a class price, and both appear in the sale inventory", async ({
  page,
}) => {
  const event = await createEvent(page, "Harbour Concert", "COPM/2");
  await expect(page.getByTestId("sale-status")).toContainText("Sales are priced in COPM");

  await definePurchasedClass(page, "General admission", "45000.50");
  await expect(
    page.getByRole("row", { name: /General admission Purchased .* 45000\.50 COPM$/ }),
  ).toBeVisible();

  let read = await inventory(page, event);
  expect(read).toMatchObject({ event, onSale: true, asset: "COPM/2" });
  expect(read.classes.map(({ name, price }) => ({ name, price }))).toEqual([
    { name: "General admission", price: 4_500_050 },
  ]);

  // A new price applies to later sales, and the inventory offers it at once.
  await expect(page.getByText("A new price applies only to sales from now on.")).toBeVisible();
  const priceForm = page.getByRole("form", { name: "Change the price of General admission" });
  await priceForm.getByLabel("New price of General admission (COPM)").fill("50000");
  await priceForm.getByRole("button", { name: "Set price" }).click();
  await expect(
    page.getByRole("row", { name: /General admission Purchased .* 50000\.00 COPM$/ }),
  ).toBeVisible();
  read = await inventory(page, event);
  expect(read.classes.map(({ price }) => price)).toEqual([5_000_000]);

  // Until the first hold, the asset can change; the console says what that does to prices.
  const sale = page.getByRole("form", { name: "Sale asset" });
  await sale.getByLabel("Sale asset").selectOption("DUSD/6");
  await expect(page.getByTestId("asset-change-warning")).toContainText(
    "General admission at 50000.00 COPM would be 5.000000 DUSD",
  );
  await sale.getByRole("button", { name: "Set sale asset" }).click();
  await expect(page.getByTestId("sale-status")).toContainText("Sales are priced in DUSD");
  await expect(
    page.getByRole("row", { name: /General admission Purchased .* 5\.000000 DUSD$/ }),
  ).toBeVisible();
  read = await inventory(page, event);
  expect(read).toMatchObject({ onSale: true, asset: "DUSD/6" });
  expect(read.classes.map(({ price }) => price)).toEqual([5_000_000]);
});

test("an event with no sale asset is not on sale, and a Purchased class cannot be priced until it has one", async ({
  page,
}) => {
  const event = await createEvent(page, "Unpriced Evening", null);
  await expect(page.getByTestId("sale-status")).toHaveText(
    "Not on sale: the event has no sale asset. Nothing of it can be sold until one is chosen.",
  );
  expect(await inventory(page, event)).toMatchObject({ onSale: false, asset: null, classes: [] });

  const form = page.getByRole("form", { name: "Define a class" });
  await form.getByLabel("Purchased — sold tickets").check();
  await expect(form.getByLabel("Price")).toBeDisabled();
  await expect(form.getByText("Choose the event's sale asset first")).toBeVisible();

  const sale = page.getByRole("form", { name: "Sale asset" });
  await sale.getByLabel("Sale asset").selectOption("DUSD/6");
  await sale.getByRole("button", { name: "Set sale asset" }).click();
  await expect(form.getByLabel("Price (DUSD)")).toBeEnabled();

  // More decimals than the asset has are refused before anything is sent.
  await form.getByLabel("Class name").fill("Early bird");
  await form.getByLabel("Price (DUSD)").fill("19.9900001");
  await form.getByRole("button", { name: "Define class" }).click();
  await expect(form.getByRole("alert")).toContainText("at most 6 decimal places");
  await form.getByLabel("Price (DUSD)").fill("19.99");
  await form.getByRole("button", { name: "Define class" }).click();
  await expect(
    page.getByRole("row", { name: /Early bird Purchased .* 19\.990000 DUSD$/ }),
  ).toBeVisible();
  expect((await inventory(page, event)).classes.map(({ price }) => price)).toEqual([19_990_000]);
});
