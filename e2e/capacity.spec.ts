import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { signUpOrganiser } from "./support/organiser";

/** A minimal, genuinely-a-PDF file: kippu-api sniffs the bytes, not just the declared type. */
function certificatePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ibento-capacity-proof-"));
  const path = join(dir, "certificate.pdf");
  writeFileSync(path, "%PDF-1.4\n% venue certificate\n%%EOF\n");
  return path;
}

async function createEvent(page: Page, name: string, capacity: number): Promise<string> {
  await page.getByRole("link", { name: "New event" }).click();
  await page.getByLabel("Event name").fill(name);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Add a zone" }).click();
  await page.getByLabel("Zone 1 name").fill("Standing");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Limit capacity").check();
  await page.getByLabel("Capacity", { exact: true }).fill(String(capacity));
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Active");
  return new URL(page.url()).hash.replace("#/events/", "");
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("US-A6 a decrease applies immediately, down to the tickets already issued", async ({
  page,
}) => {
  await createEvent(page, "Shrinking Hall", 100);
  await expect(page.getByTestId("capacity-value")).toHaveText("100");

  await page.getByRole("form", { name: "Decrease capacity" }).getByLabel("New capacity").fill("40");
  await page.getByRole("button", { name: "Decrease capacity" }).click();
  await expect(page.getByTestId("capacity-value")).toHaveText("40");
});

test("AC-A6.3 raising capacity without a validated proof fails, and the ledger's capacity never moves", async ({
  page,
}) => {
  await createEvent(page, "Guarded Hall", 50);

  await page.getByRole("form", { name: "Decrease capacity" }).getByLabel("New capacity").fill("80");
  await page.getByRole("button", { name: "Decrease capacity" }).click();
  await expect(page.getByRole("alert")).toContainText("ERR-CapacityProofRequired");
  await expect(page.getByTestId("capacity-value")).toHaveText("50");
});

test("AC-A6.4 an increase requested with an artefact waits for review, and only one request is open at a time", async ({
  page,
}) => {
  await createEvent(page, "Growing Hall", 50);

  const form = page.getByRole("form", { name: "Request a capacity increase" });
  await form.getByLabel("Requested capacity").fill("120");
  await form.getByLabel("Artefact").setInputFiles(certificatePath());
  await form.getByRole("button", { name: "Request review" }).click();

  // Never reaches the ledger on its own.
  await expect(page.getByTestId("capacity-value")).toHaveText("50");
  await expect(page.getByTestId("capacity-request-pending")).toContainText("120");
  await expect(page.getByRole("form", { name: "Request a capacity increase" })).toHaveCount(0);

  const requests = page.getByTestId("capacity-requests");
  await expect(requests).toContainText("120");
  await expect(requests).toContainText("Waiting for review");
});

test("removing the bound counts as an increase, and needs a proof like any other", async ({
  page,
}) => {
  await createEvent(page, "Unbounding Hall", 10);

  const form = page.getByRole("form", { name: "Request a capacity increase" });
  await form.getByLabel("Remove the capacity bound (unbounded issuance)").check();
  await expect(form.getByLabel("Requested capacity")).toBeDisabled();
  await form.getByLabel("Artefact").setInputFiles(certificatePath());
  await form.getByRole("button", { name: "Request review" }).click();

  await expect(page.getByTestId("capacity-request-pending")).toContainText("an unbounded capacity");
  const requests = page.getByTestId("capacity-requests");
  await expect(requests).toContainText("Unbounded");
});

test("a bad artefact is refused before it is sent", async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), "ibento-capacity-proof-"));
  const path = join(dir, "not-a-proof.txt");
  writeFileSync(path, "just some text");

  await createEvent(page, "Skeptical Hall", 10);
  const form = page.getByRole("form", { name: "Request a capacity increase" });
  await form.getByLabel("Requested capacity").fill("20");
  await form.getByLabel("Artefact").setInputFiles(path);
  await expect(page.getByText("Choose a PDF, JPEG or PNG file.")).toBeVisible();
});
