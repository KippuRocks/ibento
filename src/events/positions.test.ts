import { describe, expect, it } from "vitest";
import { MAX_POSITIONS_PER_UPLOAD, parsePositions, uploadsOf } from "./positions";

describe("seat positions", () => {
  it("takes one designation per line, exactly as written", () => {
    expect(parsePositions("C-14\nc14\nC-14 \n").positions).toEqual(["C-14", "c14", "C-14 "]);
  });

  it("removes only the line break, whichever convention the text uses", () => {
    expect(parsePositions("A-1\r\nA-2\r\n").positions).toEqual(["A-1", "A-2"]);
  });

  it("skips empty lines and keeps a repeated designation once", () => {
    expect(parsePositions("A-1\n\nA-2\nA-1\n").positions).toEqual(["A-1", "A-2"]);
  });

  it("reports the lines kippu-api would refuse", () => {
    const parsed = parsePositions(`A-1\n${"x".repeat(101)}\n\uD800\n`);
    expect(parsed.positions).toEqual(["A-1"]);
    expect(parsed.invalid.map(({ line }) => line)).toEqual([2, 3]);
  });

  it("splits a long list into uploads kippu-api accepts", () => {
    const positions = Array.from({ length: MAX_POSITIONS_PER_UPLOAD + 1 }, (_, n) => `S-${n}`);
    expect(uploadsOf(positions).map((upload) => upload.length)).toEqual([
      MAX_POSITIONS_PER_UPLOAD,
      1,
    ]);
  });
});
