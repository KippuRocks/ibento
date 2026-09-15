/** The longest designation kippu-api accepts, in UTF-16 code units. */
export const MAX_DESIGNATION_LENGTH = 100;

/** The most positions kippu-api accepts in one upload. */
export const MAX_POSITIONS_PER_UPLOAD = 50_000;

export interface InvalidLine {
  /** 1-based. */
  readonly line: number;
  readonly reason: string;
}

export interface ParsedPositions {
  /** Distinct designations, in the order first written. */
  readonly positions: readonly string[];
  readonly invalid: readonly InvalidLine[];
}

/**
 * A seated zone's canonical positions, one designation per line (`F-021` plan
 * §5.3).
 *
 * A designation is taken as written: case and spaces count, so `C-14` and `c14`
 * are two seats, and so are `C-14` and `C-14 ` with a trailing space. kippu-api
 * normalises designations to Unicode NFC (`T-021-06`), so visually identical
 * spellings are one seat. Only the line break is removed here. Empty lines are
 * skipped, and a designation written twice is one position.
 */
export function parsePositions(text: string): ParsedPositions {
  const seen = new Set<string>();
  const positions: string[] = [];
  const invalid: InvalidLine[] = [];
  text.split("\n").forEach((raw, index) => {
    const designation = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (designation === "") {
      return;
    }
    if (designation.length > MAX_DESIGNATION_LENGTH) {
      invalid.push({
        line: index + 1,
        reason: `longer than ${MAX_DESIGNATION_LENGTH} characters`,
      });
      return;
    }
    if (!designation.isWellFormed()) {
      invalid.push({ line: index + 1, reason: "not well-formed text" });
      return;
    }
    if (!seen.has(designation)) {
      seen.add(designation);
      positions.push(designation);
    }
  });
  return { positions, invalid };
}

/** Positions in uploads kippu-api accepts. */
export function uploadsOf(positions: readonly string[]): readonly (readonly string[])[] {
  const uploads: string[][] = [];
  for (let start = 0; start < positions.length; start += MAX_POSITIONS_PER_UPLOAD) {
    uploads.push(positions.slice(start, start + MAX_POSITIONS_PER_UPLOAD));
  }
  return uploads;
}
