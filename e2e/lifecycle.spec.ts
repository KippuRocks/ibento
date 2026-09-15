import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { createEvent, signUpOrganiser } from "./support/organiser";

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("AC-A4.1 sealing stops issuance; everything else keeps working, and the confirmation says so before it happens", async ({
  page,
}) => {
  await createEvent(page, "Sealed Night");

  await page.getByRole("button", { name: "Seal the event" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Confirm sealing the event" });
  await expect(dialog).toContainText("stops all further issuance");
  await expect(dialog).toContainText("transfer, resale and attendance all continue normally");
  await expect(dialog).toContainText("This cannot be undone.");

  // Backing out changes nothing.
  await dialog.getByRole("button", { name: "Keep it open" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Active");

  await page.getByRole("button", { name: "Seal the event" }).click();
  await page
    .getByRole("alertdialog", { name: "Confirm sealing the event" })
    .getByRole("button", { name: "Seal the event" })
    .click();

  await expect(page.getByTestId("event-status")).toHaveText("Sealed");
  // AC-A4.2: transfer, resale and attendance are not this console's concern, but sealing
  // itself must not remove the actions that still work on a Sealed event.
  await expect(page.getByRole("button", { name: "Seal the event" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel the event" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish now" })).toBeVisible();
});

test("AC-A5.1 cancelling lists its consequences — attendance stops, refunds are owed — before it happens", async ({
  page,
}) => {
  await createEvent(page, "Cancelled Night");

  await page.getByRole("button", { name: "Cancel the event" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Confirm cancelling the event" });
  await expect(dialog).toContainText(
    "stops every ticket of this event from being used for attendance",
  );
  await expect(dialog).toContainText("entitled to a refund");
  await expect(dialog).toContainText("original purchaser");
  await expect(dialog).toContainText("This cannot be undone.");

  await dialog.getByRole("button", { name: "Cancel the event" }).click();

  await expect(page.getByTestId("event-status")).toHaveText("Cancelled");
  await expect(page.getByTestId("lifecycle-terminal")).toContainText("cancelled");
  // AC-A5.6: Cancelled is terminal — no further lifecycle action is offered.
  await expect(page.getByRole("button", { name: "Seal the event" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel the event" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finish now" })).toHaveCount(0);
});

test("finishing now freezes every ticket alike, and the confirmation says so before it happens", async ({
  page,
}) => {
  await createEvent(page, "Finished Night");

  await page.getByRole("button", { name: "Finish now" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Confirm finishing the event" });
  await expect(dialog).toContainText("no transfer, no resale, no attendance");
  await expect(dialog).toContainText("nothing about the event or its tickets can change again");
  await expect(dialog).toContainText("This cannot be undone.");

  await dialog.getByRole("button", { name: "Finish now" }).click();

  await expect(page.getByTestId("event-status")).toHaveText("Finished");
  await expect(page.getByTestId("lifecycle-terminal")).toContainText("finished");
  // AC-A5.6/AC-A5.7: Finished is terminal.
  await expect(page.getByRole("button", { name: "Seal the event" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel the event" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finish now" })).toHaveCount(0);
});

test("REQ-EV-12 a scheduled finish is off by default, cancellable until it runs", async ({
  page,
}) => {
  await createEvent(page, "Scheduled Night");

  await expect(page.getByTestId("finish-schedule-status")).toHaveText("No scheduled finish.");

  const at = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const local = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(
    at.getDate(),
  ).padStart(2, "0")}T${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(
    2,
    "0",
  )}`;
  await page.getByLabel("Finish at").fill(local);
  await page.getByRole("button", { name: "Schedule finish" }).click();

  await expect(page.getByTestId("finish-schedule-status")).toContainText("Scheduled");
  await expect(page.getByRole("button", { name: "Cancel the scheduled finish" })).toBeVisible();
  // The event has not finished just by scheduling it.
  await expect(page.getByTestId("event-status")).toHaveText("Active");

  await page.getByRole("button", { name: "Cancel the scheduled finish" }).click();
  await expect(page.getByTestId("finish-schedule-status")).toContainText("Cancelled");
  await expect(page.getByLabel("Finish at")).toBeVisible();
});
