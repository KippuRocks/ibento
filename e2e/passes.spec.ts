import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";
import { createEvent, query, signUpOrganiser } from "./support/organiser";

interface EventPassWindow {
  readonly event: string;
  readonly windowMs: number;
  readonly isDefault: boolean;
  readonly minimumMs: number;
  readonly maximumMs: number;
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpOrganiser(page);
});

test("NFR-5 an organiser sets the event's pass window within the bounds kippu-api reports, and the event's read carries it", async ({
  page,
}) => {
  const event = await createEvent(page, "Quick Gates");
  const initial = await query<EventPassWindow>(page, "events.passWindow", { event });
  expect(initial).toMatchObject({ event, windowMs: 60_000, isDefault: true });
  const min = initial.minimumMs / 1000;
  const max = initial.maximumMs / 1000;

  const shown = page.getByTestId("pass-window");
  await expect(shown).toHaveText(
    "A holder's access pass for this event stays valid for 60 seconds (the default).",
  );
  const form = page.getByRole("form", { name: "Pass window" });
  await expect(form).toContainText(`Between ${min} and ${max} seconds.`);

  // Outside the reported bounds: refused before anything is sent.
  const sets: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("events.setPassWindow")) sets.push(request.url());
  });
  for (const seconds of [min - 1, max + 1]) {
    await form.getByLabel("Pass window (seconds)").fill(String(seconds));
    await form.getByRole("button", { name: "Set pass window" }).click();
    await expect(form.getByRole("alert")).toHaveText(
      `The pass window is between ${min} and ${max} seconds.`,
    );
  }
  expect(sets).toEqual([]);

  // Inside them: set, shown, and read back.
  await form.getByLabel("Pass window (seconds)").fill("90");
  await form.getByRole("button", { name: "Set pass window" }).click();
  await expect(shown).toHaveText(
    "A holder's access pass for this event stays valid for 90 seconds.",
  );
  expect(await query<EventPassWindow>(page, "events.passWindow", { event })).toMatchObject({
    windowMs: 90_000,
    isDefault: false,
  });

  await page.reload();
  await expect(page.getByTestId("pass-window")).toHaveText(
    "A holder's access pass for this event stays valid for 90 seconds.",
  );

  // The bounds themselves are accepted.
  await form.getByLabel("Pass window (seconds)").fill(String(max));
  await form.getByRole("button", { name: "Set pass window" }).click();
  await expect(shown).toHaveText(
    `A holder's access pass for this event stays valid for ${max} seconds.`,
  );
});
