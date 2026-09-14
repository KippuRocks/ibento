/** 32 random bytes as 64 lower-case hex characters: how a `ZoneId` is chosen (`REQ-ID-7`). */
export function randomId32(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
