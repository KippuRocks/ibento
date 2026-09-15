import { randomBytes, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { createEvent, mutate, query, signUpOrganiser } from "./support/organiser";

const API = "http://127.0.0.1:8080/v0/trpc";
/** tools/test-api/harness.mjs: Saifu's side of holder linking, transfer and pass submission, stood in for a test. */
const HOLDER_STANDIN = "http://127.0.0.1:8089";
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
    /** The pass's holder, when the report carries one (`T-025-08`): explains a transfer refusal. */
    holder?: string;
    verdict: { kind: "admitted"; submission: Submission } | { kind: "refused"; reason: string };
    clockOffset?: number;
    /** When the pass was presented; defaults to just now. Overridden for a pass submitted for real. */
    presentedAt?: number;
  },
): Promise<void> {
  const { clockOffset = 0, presentedAt, ...rest } = input;
  const now = Date.now();
  const response = await page.request.post(`${API}/operators.reportAdmission`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      reportId: randomUUID(),
      ...rest,
      presentedAt: presentedAt ?? now - 1_000,
      deviceClock: now + clockOffset,
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

interface StandInHolder {
  readonly account: string;
  readonly token: string;
}

/** A holder linked through the stand-in (`tools/test-api/harness.mjs`), Saifu-style. */
async function linkedHolder(page: Page): Promise<StandInHolder> {
  const response = await page.request.post(`${HOLDER_STANDIN}/holders`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as StandInHolder;
}

/** A tRPC call to kippu-api as a holder session, as Saifu makes it: `derived.*` reads are queries. */
async function asHolder<T>(
  page: Page,
  holder: StandInHolder,
  path: string,
  input: unknown,
): Promise<T> {
  const headers = { authorization: `Bearer ${holder.token}` };
  const response = path.startsWith("derived.")
    ? await page.request.get(`${API}/${path}?input=${encodeURIComponent(JSON.stringify(input))}`, {
        headers,
      })
    : await page.request.post(`${API}/${path}`, { headers, data: input });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).result.data as T;
}

/** The stand-in's own direct-to-ledger transfer, as Saifu would submit it (`REQ-CL-1`, `US-D1`). */
async function transferTicket(
  page: Page,
  input: { event: string; ticket: string; holder: string; receiver: string },
): Promise<{ ok: boolean; cursor?: string; errorCode?: string }> {
  const response = await page.request.post(`${HOLDER_STANDIN}/transfers`, { data: input });
  expect(response.ok()).toBe(true);
  return response.json();
}

/** The stand-in's own direct-to-ledger pass submission, as Iriguchi would (`REQ-AP-1`). */
async function submitPass(
  page: Page,
  input: { ticket: string; holder: string; presentedAt?: number },
): Promise<{ ok: boolean; errorCode?: string; passId: string; presentedAt: number }> {
  const response = await page.request.post(`${HOLDER_STANDIN}/passes/submit`, { data: input });
  expect(response.ok()).toBe(true);
  return response.json();
}

async function defineGrantedClass(page: Page, name: string): Promise<void> {
  const form = page.getByRole("form", { name: "Define a class" });
  await form.getByLabel("Class name").fill(name);
  await form.getByLabel("Cannot be resold").check();
  await form.getByRole("button", { name: "Define class" }).click();
  await expect(page.getByRole("status")).toHaveText(`Defined the class ${name}.`);
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

test("T-040-14 a real transfer between the gate's verdict and the ledger's recording is flagged, with the transfer that explains it", async ({
  page,
}) => {
  const event = await createEvent(page, "Handoff Night");
  await defineGrantedClass(page, "Friends of the house");

  // Issue a real ticket to a real holder: an invitation, redeemed through the stand-in
  // exactly as a guest would in Saifu (T-021-12, F-040 plan §5.4 "Guest lists").
  await page.getByRole("link", { name: "Guest list" }).click();
  const form = page.getByRole("form", { name: "Invite a guest" });
  await form.getByLabel("Guest").fill("Yuki");
  await form.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.locator('[data-screen="event.guests.link"]')).toBeVisible();
  const link = await page.getByLabel("Invitation link").inputValue();
  await page.getByRole("button", { name: "Done" }).click();

  const previousHolder = await linkedHolder(page);
  const redeemed = await asHolder<{ ticket: string; cursor: string }>(
    page,
    previousHolder,
    "events.invitations.redeem",
    { token: link.slice(link.indexOf("#") + 1) },
  );
  const ticket = redeemed.ticket;
  await asHolder(page, previousHolder, "derived.waitFor", {
    cursor: redeemed.cursor,
    timeout: 10_000,
  });

  // The holder transfers the ticket directly through the ledger (`REQ-CL-1`, `US-D1`) — a real
  // transfer, not a scripted one — extending the stand-in to act as Saifu would.
  const receiver = hex(32);
  const transfer = await transferTicket(page, {
    event,
    ticket,
    holder: previousHolder.account,
    receiver,
  });
  expect(transfer).toMatchObject({ ok: true });
  await query(page, "derived.waitFor", { cursor: transfer.cursor, timeout: 10_000 });

  // The previous holder's pass, produced and presented for real, is refused: the ticket
  // already left them.
  const submitted = await submitPass(page, { ticket, holder: previousHolder.account });
  expect(submitted).toMatchObject({ ok: false, errorCode: "ERR-InvalidPass" });

  // Iriguchi reports exactly what it saw at the gate — including who the pass named as holder,
  // so Kippu can explain the refusal (`T-025-08`).
  const north = await operatorAt(page, event, "Noor", "North door");
  await report(page, north, {
    event,
    gate: "North door",
    ticket,
    passId: submitted.passId,
    holder: previousHolder.account,
    presentedAt: submitted.presentedAt,
    verdict: {
      kind: "admitted",
      submission: { outcome: "rejected", errorCode: "ERR-InvalidPass" },
    },
  });

  await page.goto(`/#/events/${event}/flags`);
  const flag = page.getByTestId("flag");
  await expect(flag).toHaveCount(1);
  await expect(flag).toHaveAttribute("data-cause", "transfer-before-recording");
  await expect(flag).toContainText(
    "Ticket transferred between the gate's verdict and the ledger's recording",
  );
  await expect(flag).toContainText("no longer held the ticket");
  await expect(flag).toContainText("ERR-InvalidPass");
  await expect(flag).toContainText(
    `Transferred from ${previousHolder.account.slice(0, 12)}… to ${receiver.slice(0, 12)}…`,
  );
});
