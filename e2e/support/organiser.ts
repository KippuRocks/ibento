import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** A fresh organiser email per test: the store outlives test runs. */
export function organiserEmail(): string {
  return `organiser-${randomUUID()}@example.com`;
}

/** Signs a new organiser up through the console, with the page's virtual authenticator. */
export async function signUpOrganiser(page: Page): Promise<string> {
  const email = organiserEmail();
  await page.goto("/");
  await page.getByRole("button", { name: "Create an organiser account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  return email;
}

/**
 * Calls a Kippu API procedure from the page, with the console's session: for a
 * test to read what the API holds, independently of what the console shows.
 */
export async function query<T>(page: Page, path: string, input?: unknown): Promise<T> {
  return page.evaluate(
    async ({ path, input }) => {
      const stored = JSON.parse(sessionStorage.getItem("ibento.session") ?? "null");
      const search =
        input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
      const response = await fetch(`/v0/trpc/${path}${search}`, {
        headers: { authorization: `Bearer ${stored.token}` },
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(`${path} failed: ${JSON.stringify(body)}`);
      }
      return body.result.data;
    },
    { path, input },
  ) as Promise<T>;
}
