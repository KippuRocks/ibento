import { defineConfig, devices } from "@playwright/test";

const CI = process.env.CI !== undefined;

/**
 * End-to-end tests drive the built console in Chromium against the real
 * kippu-api, at the commit Ibento's `@kippurocks/api` types were vendored from
 * (`tools/test-api.sh`).
 *
 * The console is served at `http://localhost:4173`: an origin kippu-api accepts
 * login ceremonies from, on `localhost`, the login RP id. The preview server
 * forwards `/v0/trpc` to the API.
 */
export default defineConfig({
  testDir: "e2e",
  // One worker: AC-A3.1 counts the ledger records written while an edit runs, which any
  // concurrent test's writes to the shared test API would disturb.
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "tools/test-api.sh",
      url: "http://127.0.0.1:8080/health",
      reuseExistingServer: !CI,
      timeout: 300_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm build && pnpm preview",
      url: "http://localhost:4173",
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
