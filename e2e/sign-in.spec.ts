import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./support/authenticator";

/** A fresh organiser email per test: the store outlives test runs. */
function organiserEmail(): string {
  return `organiser-${randomUUID()}@example.com`;
}

test.beforeEach(async ({ page }) => {
  await addVirtualAuthenticator(page);
});

test("an organiser signs up with a passkey, signs out, and signs back in", async ({ page }) => {
  const email = organiserEmail();
  await page.goto("/");

  await page.getByRole("button", { name: "Create an organiser account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Ibento" })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  // The session survives a reload, and kippu-api still recognises its token.
  const current = page.waitForResponse((response) =>
    response.url().includes("/v0/trpc/auth.session.current"),
  );
  await page.reload();
  expect((await current).status()).toBe(200);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test("signing in with an email that has no organiser account is refused", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(organiserEmail());
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByRole("alert")).toHaveText("No organiser account uses this email.");
});

test("a session kippu-api has ended sends the organiser back to sign-in", async ({ page }) => {
  const email = organiserEmail();
  await page.goto("/");
  await page.getByRole("button", { name: "Create an organiser account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  // End the session at kippu-api behind the console's back, then reload.
  await page.evaluate(async () => {
    const stored = JSON.parse(sessionStorage.getItem("ibento.session") ?? "null");
    await fetch("/v0/trpc/auth.session.signOut", {
      method: "POST",
      headers: { authorization: `Bearer ${stored.token}`, "content-type": "application/json" },
      body: "{}",
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in to Ibento" })).toBeVisible();
});
