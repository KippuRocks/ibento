import type { Page } from "@playwright/test";

/**
 * Gives the page Chromium's virtual WebAuthn authenticator: a platform
 * authenticator that holds discoverable credentials, verifies the user, and
 * answers every prompt without a person present.
 */
export async function addVirtualAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}
