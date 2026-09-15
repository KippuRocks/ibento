/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where invitation links point (see `src/guests/invitations.ts`). Read at build time. */
  readonly SAIFU_LINK_BASE?: string;
}
