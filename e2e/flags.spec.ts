import { randomBytes, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { createEvent, mutate, signUpOrganiser } from "./support/organiser";

const API = "http://127.0.0.1:8080/v0/trpc";
const HOUR = 60 * 60 * 1000;
const hex = (bytes: number) => randomBytes(bytes).toString("hex");

type Submission =
  | { outcome: "settled"; cursor: string }
  | { outcome: "rejected"; errorCode: string }
  | { outcome: "failed" };

/** An operator of the organiser, granted one gate of the event, enrolled as Iriguchi would be. */
async function operatorAt(page: Page, event: string, name: string, gate: string): Promise<string> {
  const { id } = await mutate<{ id: string }>(page, "operators.create", { name });
  const now = Date.now();
  await mutate(page, "operators.grants.create", {
    operator: id,
    event,
    gates: [gate],
    from: now - HOUR,
    until: now + HOUR,
  });
  const { code } = await mutate<{ code: string }>(page, "operators.issueEnrolmentCode", {
    operator: id,
  });
  const response = await page.request.post(`${API}/auth.operator.redeemEnrolmentCode`, {
    data: { code },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).result.data.session.token as string;
}

/** Iriguchi's report of a verdict at its gate (`F-024` plan §5.3), as the stand-in scripts it. */
async function report(
  page: Page,
  token: string,
  input: {
    event: string;
    gate: string;
    ticket: string;
    passId: string;
    verdict: { kind: "admitted"; submission: Submission } | { kind: "refused"; reason: string };
    clockOffset?: number;
  },
): Promise<void> {
  const { clockOffset = 0, ...rest } = input;
  const now = Date.now();
  const response = await page.request.post(`${API}/operators.reportAdmission`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      reportId: randomUUID(),
      ...rest,
      presentedAt: now - 1_000,
      deviceClock: now + clockOffset,
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("REQ-OP-3 scripted refusals of provisional admissions appear in the flag inbox with their causes", async ({
  page,
}) => {
  const event = await createEvent(page, "Flagged Night");
  const north = await operatorAt(page, event, "Noor", "North door");
  const south = await operatorAt(page, event, "Sami", "South door");

  // The same pass admitted at both gates: the ledger recorded the first, and refused the second as a replay.
  const replayedTicket = hex(32);
  const replayedPass = hex(16);
  await report(page, north, {
    event,
    gate: "North door",
    ticket: replayedTicket,
    passId: replayedPass,
    verdict: { kind: "admitted", submission: { outcome: "settled", cursor: "scripted-1" } },
  });
  await report(page, south, {
    event,
    gate: "South door",
    ticket: replayedTicket,
    passId: replayedPass,
    verdict: {
      kind: "admitted",
      submission: { outcome: "rejected", errorCode: "ERR-PassReplayed" },
    },
  });

  // A gate 30 s ahead admitted a pass the ledger found expired.
  await report(page, north, {
    event,
    gate: "North door",
    ticket: hex(32),
    passId: hex(16),
    verdict: {
      kind: "admitted",
      submission: { outcome: "rejected", errorCode: "ERR-PassExpired" },
    },
    clockOffset: 30_000,
  });

  // A gate 15 s behind whose admission the ledger recorded: its clock is flagged all the same.
  await report(page, south, {
    event,
    gate: "South door",
    ticket: hex(32),
    passId: hex(16),
    verdict: { kind: "admitted", submission: { outcome: "settled", cursor: "scripted-2" } },
    clockOffset: -15_000,
  });

  // A pass the ledger found invalid, with no transfer of its ticket to explain it.
  await report(page, north, {
    event,
    gate: "North door",
    ticket: hex(32),
    passId: hex(16),
    verdict: {
      kind: "admitted",
      submission: { outcome: "rejected", errorCode: "ERR-InvalidPass" },
    },
  });

  // Not flagged: an admission recorded within tolerance, a refusal at the gate, a failed submission.
  for (const verdict of [
    { kind: "admitted", submission: { outcome: "settled", cursor: "scripted-3" } },
    { kind: "refused", reason: "ERR-TicketExpired" },
    { kind: "admitted", submission: { outcome: "failed" } },
  ] as const) {
    await report(page, north, {
      event,
      gate: "North door",
      ticket: hex(32),
      passId: hex(16),
      verdict,
    });
  }

  await page.goto(`/#/events/${event}`);
  await page.getByRole("link", { name: "Admission flags" }).click();
  await expect(page.locator('[data-screen="event.flags"]')).toBeVisible();

  const flags = page.getByTestId("flag");
  await expect(flags).toHaveCount(4);

  const replay = page.locator('[data-cause="same-pass-at-two-gates"]');
  await expect(replay).toHaveCount(1);
  await expect(replay).toContainText("Same pass admitted at two gates");
  await expect(replay).toContainText(
    "The ledger recorded the attendance once and refused the other",
  );
  await expect(replay).toContainText("South door");
  await expect(replay).toContainText("Sami");
  await expect(replay).toContainText("ERR-PassReplayed");
  await expect(replay).toContainText("Also at North door: admitted, recorded by the ledger");

  const clocks = page.locator('[data-cause="gate-clock-outside-tolerance"]');
  await expect(clocks).toHaveCount(2);
  const ahead = clocks.filter({ hasText: "ERR-PassExpired" });
  await expect(ahead).toContainText("Gate clock outside tolerance");
  await expect(ahead).toContainText("until the device's time is corrected");
  await expect(ahead).toContainText("Noor");
  await expect(ahead).toContainText(/\+30\.\d s|\+29\.\d s/);
  const behind = clocks.filter({ hasText: "Sami" });
  await expect(behind).toContainText("None");
  await expect(behind).toContainText(/−1[45]\.\d s/);

  const unexplained = page.locator('[data-cause="unexplained"]');
  await expect(unexplained).toHaveCount(1);
  await expect(unexplained).toContainText("Refused by the ledger for another reason");
  await expect(unexplained).toContainText("Its refusal code says why.");

  // Evidence only: nothing on the page acts on a ticket.
  await expect(page.locator('[data-screen="event.flags"] button')).toHaveCount(0);
  await expect(unexplained).toContainText("ERR-InvalidPass");
});

test("an event with no flagged admissions says so", async ({ page }) => {
  const event = await createEvent(page, "Quiet Night");
  await page.goto(`/#/events/${event}/flags`);
  await expect(page.getByText("No flags.")).toBeVisible();
  await expect(page.getByTestId("flags-freshness")).toBeVisible();
});
