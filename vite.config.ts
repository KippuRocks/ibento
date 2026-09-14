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

export default defineConfig({
  plugins: [react()],
  server: { host: "localhost", port: 5173, strictPort: true, proxy },
  preview: { host: "localhost", port: 4173, strictPort: true, proxy },
});
