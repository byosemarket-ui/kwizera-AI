import { describe, expect, it } from "vitest";
import { buildProductMask } from "../../../../ai/product-asset-preparation/png-canvas.js";
import { buildNormalizedProductCutout } from "../../../../ai/product-asset-preparation/png-canvas.js";

describe("product mask generation", () => {
  it("produces a non-empty mask PNG from cutout canvas", () => {
    const canvas = buildNormalizedProductCutout({
      canvasSize: 32,
      sourceBytes: Buffer.from("test-image-bytes"),
      preserveShadows: false,
      preserveReflections: false,
      softEdges: true,
    });
    const mask = buildProductMask(canvas);
    expect(mask.length).toBeGreaterThan(100);
    expect(mask.subarray(0, 4).toString("hex")).toBe("89504e47");
  });
});
