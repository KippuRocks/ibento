import { describe, expect, it } from "vitest";
import { imageProblem, MAX_IMAGE_BYTES } from "./images";

describe("event images", () => {
  it("accepts JPEG, PNG and WebP up to 2 MiB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(imageProblem({ type, size: MAX_IMAGE_BYTES })).toBeNull();
    }
  });

  it("refuses SVG and every other type", () => {
    expect(imageProblem({ type: "image/svg+xml", size: 100 })).toMatch(/JPEG, PNG or WebP/);
    expect(imageProblem({ type: "image/gif", size: 100 })).toMatch(/JPEG, PNG or WebP/);
  });

  it("refuses an image over 2 MiB, or an empty one", () => {
    expect(imageProblem({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toMatch(/2 MiB/);
    expect(imageProblem({ type: "image/png", size: 0 })).toMatch(/empty/);
  });
});
