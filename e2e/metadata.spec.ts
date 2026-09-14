import { expect, type Page, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { createEvent, mutate, query, signUpOrganiser } from "./support/organiser";

/** A 1×1 PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

interface Waited {
  readonly reached: boolean;
  readonly freshness: { readonly records: number };
}

interface EventRead {
  readonly event: {
    readonly metadata: {
      readonly description?: string;
      readonly imagery?: readonly { readonly url: string; readonly alt?: string }[];
    } | null;
  };
}

function randomZoneId(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
}

/**
 * Writes one ledger record — a zone added — and answers how many records Kippu's
 * derived copy reflects once it has read that write. Between two such marks, the
 * difference counts every ledger record written in between, plus the mark itself.
 */
async function ledgerRecordsAtMark(page: Page, event: string): Promise<number> {
  const { cursor } = await mutate<{ cursor: string }>(page, "events.zones.add", {
    event,
    zone: { id: randomZoneId(), kind: "Unseated" },
  });
  const waited = await query<Waited>(page, "derived.waitFor", { cursor, timeout: 10_000 });
  expect(waited.reached).toBe(true);
  return waited.freshness.records;
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("AC-A3.1 editing an event's description and images writes nothing to the ledger", async ({
  page,
}) => {
  const event = await createEvent(page, "Harvest Fair");

  const before = await ledgerRecordsAtMark(page, event);

  await page.getByRole("link", { name: "Edit details" }).click();
  await expect(page.getByLabel("Event name")).toHaveValue("Harvest Fair");
  await page.getByLabel("Description").fill("Cider, bread and a brass band.");
  await page.getByLabel("Add an image").setInputFiles({
    name: "poster.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByTestId("event-image")).toHaveCount(1);
  await page.getByLabel("Image 1 description").fill("The fair's poster");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "Harvest Fair" })).toBeVisible();
  await expect(page.getByText("Cider, bread and a brass band.")).toBeVisible();

  const after = await ledgerRecordsAtMark(page, event);
  const control = await ledgerRecordsAtMark(page, event);
  // The edit's window holds exactly as many records as a window with no edit: the marks'.
  expect(after - before).toBe(control - after);

  const read = await query<EventRead>(page, "derived.events.get", { event });
  expect(read.event.metadata?.description).toBe("Cider, bread and a brass band.");
  expect(read.event.metadata?.imagery).toEqual([
    {
      url: expect.stringMatching(new RegExp(`/v0/images/${event}/[0-9a-f]{64}\\.png$`)),
      alt: "The fair's poster",
      mediaType: "image/png",
    },
  ]);
});

test("an image that is not JPEG, PNG or WebP is refused before upload", async ({ page }) => {
  await createEvent(page, "Vector Night");
  await page.getByRole("link", { name: "Edit details" }).click();
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("metadata.images.upload")) uploads.push(request.url());
  });
  await page.getByLabel("Add an image").setInputFiles({
    name: "map.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(page.getByRole("alert")).toHaveText("Choose a JPEG, PNG or WebP image.");
  expect(uploads).toEqual([]);
});

test("kippu-api's refusal of an image is shown", async ({ page }) => {
  await createEvent(page, "Mislabelled Night");
  await page.getByRole("link", { name: "Edit details" }).click();
  await page.getByLabel("Add an image").setInputFiles({
    name: "not-really.png",
    mimeType: "image/png",
    buffer: Buffer.from("these bytes are not a PNG"),
  });
  await expect(page.getByRole("alert")).toContainText("the image's bytes are not image/png");
  await expect(page.getByTestId("event-image")).toHaveCount(0);
});
