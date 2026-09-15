import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { query, signUpOrganiser } from "./support/organiser";

const API = "http://127.0.0.1:8080/v0/trpc";
/** tools/test-api/harness.mjs: Saifu's side of holder linking, stood in for a test. */
const HOLDER_STANDIN = "http://127.0.0.1:8089/holders";
/** Saifu's invitation screen at the placeholder origin; the token follows in the fragment. */
const INVITATION_LINK_PREFIX = "https://saifu.kippu.example/invitations#";

interface Holder {
  readonly account: string;
  readonly token: string;
}

interface Holding {
  readonly ticket: {
    readonly id: string;
    readonly event: string;
    readonly holder: string;
    readonly class: string;
    readonly provenance: string;
    readonly placement: { readonly kind: string; readonly position?: string };
    readonly restrictions: { readonly cannotResale: boolean; readonly cannotTransfer: boolean };
    readonly kippuClass: { readonly name: string } | null;
  };
}

/** A guest who has Saifu: a holder account on the ledger, linked to Kippu in a holder session. */
async function linkedGuest(page: Page): Promise<Holder> {
  const response = await page.request.post(HOLDER_STANDIN);
  expect(response.ok()).toBe(true);
  return (await response.json()) as Holder;
}

/** A tRPC call to kippu-api as a holder session, as Saifu makes it. */
async function asHolder<T>(
  page: Page,
  holder: Holder,
  path: string,
  input?: unknown,
): Promise<{
  ok: boolean;
  body: { result?: { data: T }; error?: { data?: { code?: string; errorCode?: string | null } } };
}> {
  const headers = { authorization: `Bearer ${holder.token}` };
  const response =
    input === undefined || path.startsWith("derived.")
      ? await page.request.get(
          `${API}/${path}${input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`}`,
          { headers },
        )
      : await page.request.post(`${API}/${path}`, { headers, data: input });
  return { ok: response.ok(), body: await response.json() };
}

async function createSeatedEvent(page: Page): Promise<string> {
  await page.getByRole("link", { name: "New event" }).click();
  await page.getByLabel("Event name").fill("Opening Night");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Add a zone" }).click();
  await page.getByLabel("Zone 1 name").fill("Stalls");
  await page.getByLabel("Zone 1 kind").selectOption("Seated");
  await page.getByLabel("Zone 1 seat positions").fill("A-1\nA-2\n");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Active");
  return new URL(page.url()).hash.replace("#/events/", "");
}

async function defineGrantedClass(page: Page, name: string): Promise<void> {
  const form = page.getByRole("form", { name: "Define a class" });
  await form.getByLabel("Class name").fill(name);
  await form.getByLabel("Cannot be resold").check();
  await form.getByRole("button", { name: "Define class" }).click();
  await expect(page.getByRole("status")).toHaveText(`Defined the class ${name}.`);
}

async function invite(page: Page, seat: string, guest: string): Promise<string> {
  const form = page.getByRole("form", { name: "Invite a guest" });
  await form.getByLabel("Seat").fill(seat);
  await form.getByLabel("Guest").fill(guest);
  await form.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.locator('[data-screen="event.guests.link"]')).toBeVisible();
  const link = await page.getByLabel("Invitation link").inputValue();
  await expect(page.getByText("This link is shown only this once.")).toBeVisible();
  return link;
}

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("US-B2 a guest who links in Saifu receives the class's ticket (REQ-TC-4)", async ({
  page,
}) => {
  const event = await createSeatedEvent(page);
  await defineGrantedClass(page, "Friends of the house");

  await page.getByRole("link", { name: "Guest list" }).click();
  await expect(page.getByText("No invitations yet.")).toBeVisible();

  // The organiser invites a guest to a seat, and gets the link once.
  const link = await invite(page, "A-1", "Ada");
  expect(link.startsWith(INVITATION_LINK_PREFIX)).toBe(true);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status")).toHaveText("Copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await page.getByRole("button", { name: "Done" }).click();

  const row = page.getByTestId("invitation").filter({ hasText: "Ada" });
  await expect(row).toContainText("Waiting for the guest");
  await expect(row).toContainText("Not linked yet");
  await expect(page.getByLabel("Invitation link")).toHaveCount(0);

  // The guest follows the link to Saifu, links a holder account there and redeems the token.
  const token = link.slice(INVITATION_LINK_PREFIX.length);
  const guest = await linkedGuest(page);
  const redeemed = await asHolder<{ ticket: string; cursor: string; class: string }>(
    page,
    guest,
    "events.invitations.redeem",
    { token },
  );
  expect(redeemed.ok).toBe(true);
  const ticket = redeemed.body.result?.data.ticket ?? "";

  // Ibento shows who linked, and the ticket issued to them, without a reload.
  await expect(row).toContainText("Ticket issued");
  await expect(row).toContainText(guest.account);
  await expect(row).toContainText(ticket);

  // The guest holds the class's ticket: granted, at the seat, with the class's restrictions.
  const cursor = redeemed.body.result?.data.cursor ?? "";
  await asHolder(page, guest, "derived.waitFor", { cursor, timeout: 10_000 });
  const holdings = await asHolder<{ holdings: readonly Holding[] }>(
    page,
    guest,
    "derived.holdings.mine",
  );
  const classes = await query<readonly { id: string; name: string }[]>(
    page,
    "events.classes.list",
    {
      event,
    },
  );
  expect(holdings.body.result?.data.holdings.map(({ ticket }) => ticket)).toEqual([
    expect.objectContaining({
      id: ticket,
      event,
      holder: guest.account,
      class: classes[0]?.id,
      provenance: "Granted",
      placement: expect.objectContaining({ kind: "Seated" }),
      restrictions: { cannotResale: true, cannotTransfer: false },
      kippuClass: { name: "Friends of the house" },
    }),
  ]);

  // The token redeems once.
  const again = await asHolder(page, await linkedGuest(page), "events.invitations.redeem", {
    token,
  });
  expect(again.ok).toBe(false);
});

test("an invitation to a seat that already has one is warned about, and the second redemption is refused", async ({
  page,
}) => {
  await createSeatedEvent(page);
  await defineGrantedClass(page, "Press");
  await page.getByRole("link", { name: "Guest list" }).click();

  const first = await invite(page, "A-2", "First guest");
  await page.getByRole("button", { name: "Done" }).click();

  const form = page.getByRole("form", { name: "Invite a guest" });
  await form.getByLabel("Seat").fill("A-2");
  await expect(page.getByTestId("seat-conflict")).toContainText(
    "Seat A-2 already has an open invitation",
  );
  await form.getByLabel("Seat").fill("A-1");
  await expect(page.getByTestId("seat-conflict")).toHaveCount(0);
  const second = await invite(page, "A-2", "Second guest");
  await page.getByRole("button", { name: "Done" }).click();

  const tokenOf = (link: string) => link.slice(INVITATION_LINK_PREFIX.length);
  const winner = await asHolder(page, await linkedGuest(page), "events.invitations.redeem", {
    token: tokenOf(first),
  });
  expect(winner.ok).toBe(true);
  const loser = await asHolder(page, await linkedGuest(page), "events.invitations.redeem", {
    token: tokenOf(second),
  });
  expect(loser.ok).toBe(false);

  await expect(page.getByTestId("invitation").filter({ hasText: "First guest" })).toContainText(
    "Ticket issued",
  );
  await form.getByLabel("Seat").fill("A-2");
  await expect(page.getByTestId("seat-conflict")).toContainText("has already been issued");
});
