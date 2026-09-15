import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { signUpOrganiser } from "./support/organiser";

const HOLDER_STANDIN = "http://127.0.0.1:8089";

interface CreatedReviewer {
  readonly email: string;
  readonly code: string;
}

/** tools/test-api/harness.mjs stands in for whoever has deployment access (`T-021-16`). */
async function createReviewer(page: Page): Promise<CreatedReviewer> {
  const email = `reviewer-${randomUUID()}@example.com`;
  const response = await page.request.post(`${HOLDER_STANDIN}/reviewers`, { data: { email } });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as CreatedReviewer;
  return { email, code: body.code };
}

function certificatePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ibento-reviewer-"));
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

async function requestIncrease(page: Page, capacity: number): Promise<void> {
  const form = page.getByRole("form", { name: "Request a capacity increase" });
  await form.getByLabel("Requested capacity").fill(String(capacity));
  await form.getByLabel("Artefact").setInputFiles(certificatePath());
  await form.getByRole("button", { name: "Request review" }).click();
  await expect(page.getByTestId("capacity-request-pending")).toContainText(String(capacity));
}

/** Enrols a freshly created reviewer through Ibento's own reviewer portal. */
async function enrolReviewer(page: Page, reviewer: CreatedReviewer): Promise<void> {
  await page.goto("/#/reviewer/queue");
  await expect(page.locator('[data-screen="reviewer.sign-in"]')).toBeVisible();
  await page.getByRole("button", { name: "I have an enrolment code" }).click();
  await expect(page.locator('[data-screen="reviewer.enrol"]')).toBeVisible();
  await page.getByLabel("Email").fill(reviewer.email);
  await page.getByLabel("Enrolment code").fill(reviewer.code);
  await page.getByRole("button", { name: "Register a passkey" }).click();
  await expect(page.locator('[data-screen="reviewers.queue"]')).toBeVisible();
  await expect(page.getByText(`Signed in as ${reviewer.email}`)).toBeVisible();
}

/**
 * The queue is Kippu-wide (every reviewer sees every organiser's requests), so
 * other tests' — and other organisers' — pending requests may already be
 * there. Every assertion below is scoped to the one row this test's own event
 * produced, by the event id the console truncates it to.
 */
function rowFor(page: Page, event: string): Locator {
  return page.getByTestId("proof-request").filter({ hasText: event.slice(0, 12) });
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
});

test("T-021-16/T-021-08 a reviewer enrols with a one-time code, and only a reviewer session reaches the queue", async ({
  page,
}) => {
  await signUpOrganiser(page);
  const event = await createEvent(page, "Reviewed Hall", 50);
  await requestIncrease(page, 200);

  const reviewer = await createReviewer(page);
  await enrolReviewer(page, reviewer);

  const row = rowFor(page, event);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("200");
  await expect(row).toContainText("application/pdf");

  // The artefact opens in a new tab, as the reviewer's own look at it — a PDF, Chromium
  // may render inline or hand to the browser's download handling; either is the artefact
  // reaching the reviewer, so either counts here.
  const [outcome] = await Promise.all([
    Promise.race([page.waitForEvent("popup"), page.waitForEvent("download")]),
    row.getByRole("button", { name: "View artefact" }).click(),
  ]);
  if ("close" in outcome) {
    await outcome.close();
  }

  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row).toHaveCount(0);

  // Signing out of the reviewer portal returns to reviewer sign-in — never the organiser's.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator('[data-screen="reviewer.sign-in"]')).toBeVisible();

  // Back in the organiser console (the same tab, a different area of the same origin), the
  // increase the reviewer approved has reached the ledger.
  await page.goto(`/#/events/${event}`);
  await expect(page.getByTestId("capacity-value")).toHaveText("200");
  const requests = page.getByTestId("capacity-requests");
  await expect(requests).toContainText("Approved");
});

test("a rejected request never reaches the ledger", async ({ page }) => {
  await signUpOrganiser(page);
  const event = await createEvent(page, "Declined Hall", 30);
  await requestIncrease(page, 90);

  const reviewer = await createReviewer(page);
  await enrolReviewer(page, reviewer);

  const row = rowFor(page, event);
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Reject" }).click();
  await expect(row).toHaveCount(0);

  await page.goto(`/#/events/${event}`);
  await expect(page.getByTestId("capacity-value")).toHaveText("30");
  const requests = page.getByTestId("capacity-requests");
  await expect(requests).toContainText("Rejected");
  // The organiser may ask again.
  await expect(page.getByRole("form", { name: "Request a capacity increase" })).toBeVisible();
});

test("an unenrolled visit to the queue asks for sign-in, not the organiser console", async ({
  page,
}) => {
  await page.goto("/#/reviewer/queue");
  await expect(page.locator('[data-screen="reviewer.sign-in"]')).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create an organiser account" })).toHaveCount(0);
});
