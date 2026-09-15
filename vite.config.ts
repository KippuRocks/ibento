import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Where the development and preview servers forward `/v0/trpc`: a local kippu-api
 * (`tools/test-api.sh`).
 *
 * Ibento calls the API at its own origin, so the browser needs no cross-origin
 * access to it. How the two are served together outside local development is
 * a hosting decision that has not been taken.
 */
const apiTarget = process.env.KIPPU_API_URL ?? "http://127.0.0.1:8080";
const proxy = { "/v0/trpc": { target: apiTarget, changeOrigin: false } };

// Checked here, so a console built with a malformed Saifu origin fails to build.
const saifuLinkBase = process.env.SAIFU_LINK_BASE;
if (saifuLinkBase !== undefined) {
  const url = URL.canParse(saifuLinkBase) ? new URL(saifuLinkBase) : null;
  if (url === null || url.protocol !== "https:" || url.origin !== saifuLinkBase) {
    throw new Error(`SAIFU_LINK_BASE must be an https origin with no path, not ${saifuLinkBase}`);
  }
}

export default defineConfig({
  plugins: [react()],
  // SAIFU_LINK_BASE: where invitation links point, until Saifu's handoff defines them.
  envPrefix: ["VITE_", "SAIFU_"],
  server: { host: "localhost", port: 5173, strictPort: true, proxy },
  preview: { host: "localhost", port: 4173, strictPort: true, proxy },
});
