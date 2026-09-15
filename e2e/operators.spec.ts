import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { ledgerRecordsAtMark } from "./support/ledger";
import { createEvent, query, signUpOrganiser } from "./support/organiser";

const API = "http://127.0.0.1:8080/v0/trpc";

interface Check {
  readonly status: number;
  readonly reason: string | null;
}

/** A `datetime-local` value for an instant, in the browser's time zone (the test's). */
function local(time: number): string {
  const at = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** Iriguchi's side, stood in for: redeem the enrolment code for an operator session. */
async function enrolOperator(page: Page, code: string): Promise<string> {
  const response = await page.request.post(`${API}/auth.operator.redeemEnrolmentCode`, {
    data: { code },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).result.data.session.token as string;
}

/** Iriguchi's check alongside validation (`AC-E5.2`): may this operator admit at the gate now? */
async function check(page: Page, token: string, event: string, gate: string): Promise<Check> {
  const response = await page.request.get(
    `${API}/operators.check?input=${encodeURIComponent(JSON.stringify({ event, gate }))}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const body = await response.json();
  return { status: response.status(), reason: body.error?.data?.reason ?? null };
}

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("AC-E5.1 an organiser authorises an operator for gates and a window and revokes it, and no ledger state changes", async ({
  page,
}) => {
  const event = await createEvent(page, "Stadium Night");
  const before = await ledgerRecordsAtMark(page, event);

  // An operator, and a one-time enrolment code shown once.
  await page.getByRole("link", { name: "Operators", exact: true }).click();
  await page.getByLabel("Operator name").fill("Kenji");
  await page.getByRole("button", { name: "Add operator" }).click();
  const row = page.getByTestId("operator").filter({ hasText: "Kenji" });
  await row.getByRole("button", { name: "Issue enrolment code" }).click();
  await expect(page.locator('[data-screen="operators.enrolment-code"]')).toBeVisible();
  await expect(page.getByText("This code is shown only this once.")).toBeVisible();
  const code = await page.getByLabel("Enrolment code").inputValue();
  await page.getByRole("button", { name: "Copy code" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByLabel("Enrolment code")).toHaveCount(0);

  const operator = await enrolOperator(page, code);
  await expect(page.getByTestId("operator").filter({ hasText: "Kenji" })).toBeVisible();

  // Granted two gates of the event, for a window around now.
  await page.goto(`/#/events/${event}`);
  await page.getByRole("link", { name: "Gate access" }).click();
  const form = page.getByRole("form", { name: "Grant gate access" });
  await form.getByLabel("Operator").selectOption({ label: "Kenji" });
  await form.getByLabel("Gates").fill("North door\nSouth door");
  const now = Date.now();
  await form.getByLabel("From").fill(local(now - 60 * 60 * 1000));
  await form.getByLabel("Until").fill(local(now + 4 * 60 * 60 * 1000));
  await form.getByRole("button", { name: "Grant access" }).click();
  const grant = page.getByTestId("grant").filter({ hasText: "Kenji" });
  await expect(grant).toContainText("North door, South door");
  await expect(grant).toContainText("Active");

  // Scoped: the granted gates, and only those.
  expect(await check(page, operator, event, "North door")).toEqual({ status: 200, reason: null });
  expect(await check(page, operator, event, "West door")).toEqual({
    status: 403,
    reason: "not-granted",
  });

  // Revoked in one action: the next check is refused.
  await grant.getByRole("button", { name: "Revoke" }).click();
  await expect(grant).toContainText("Revoked");
  expect(await check(page, operator, event, "North door")).toEqual({
    status: 403,
    reason: "grant-revoked",
  });

  // Ending the operator's sessions refuses them before any check.
  await page.getByRole("link", { name: "Operators", exact: true }).click();
  await page
    .getByTestId("operator")
    .filter({ hasText: "Kenji" })
    .getByRole("button", { name: "Revoke sessions" })
    .click();
  await expect(page.getByRole("status")).toContainText("Ended 1 session");
  expect((await check(page, operator, event, "North door")).status).toBe(401);

  // None of it reached the ledger: the window holds exactly the records of a window with nothing in it.
  const after = await ledgerRecordsAtMark(page, event);
  const control = await ledgerRecordsAtMark(page, event);
  expect(after - before).toBe(control - after);

  const grants = await query<readonly { gates: readonly string[]; revokedAt: string | null }[]>(
    page,
    "operators.grants.list",
    { event, operator: null },
  );
  expect(grants).toEqual([
    expect.objectContaining({ gates: ["North door", "South door"], revokedAt: expect.any(String) }),
  ]);
});

test("a grant that ends before it starts is refused before it is sent", async ({ page }) => {
  const event = await createEvent(page, "Backwards Night");
  await page.getByRole("link", { name: "Operators", exact: true }).click();
  await page.getByLabel("Operator name").fill("Ayla");
  await page.getByRole("button", { name: "Add operator" }).click();
  await expect(page.getByTestId("operator").filter({ hasText: "Ayla" })).toBeVisible();

  await page.goto(`/#/events/${event}/operators`);
  const form = page.getByRole("form", { name: "Grant gate access" });
  await form.getByLabel("Gates").fill("Main gate");
  const now = Date.now();
  await form.getByLabel("From").fill(local(now + 60 * 60 * 1000));
  await form.getByLabel("Until").fill(local(now));
  await form.getByRole("button", { name: "Grant access" }).click();
  await expect(form.getByRole("alert")).toHaveText("The grant must end after it starts.");
  await expect(page.getByText("No one has been granted access yet.")).toBeVisible();
});
