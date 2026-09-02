import { describe, expect, it } from "vitest";
import { buildNormalizedProductCutout, buildProductMask, PREPARATION_METHOD } from "../../../../ai/product-asset-preparation/png-canvas.js";
import { productOnWhitePngBase64 } from "./fixtures.js";

describe("product mask generation", () => {
  it("produces a non-empty mask PNG from a source-preserving cutout", () => {
    const sourceBytes = Buffer.from(productOnWhitePngBase64(48, 48), "base64");
    const canvas = buildNormalizedProductCutout({
      sourceBytes,
      maxEdge: 48,
      preserveShadows: false,
      preserveReflections: false,
      softEdges: true,
    });
    expect(canvas).not.toBeNull();
    expect(canvas!.method).toBe(PREPARATION_METHOD);
    expect(canvas!.productPreserved).toBe(true);
    const mask = buildProductMask(canvas!);
    expect(mask.length).toBeGreaterThan(100);
    expect(mask.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("refuses cutout when source PNG cannot be decoded", () => {
    const canvas = buildNormalizedProductCutout({
      sourceBytes: Buffer.from("not-a-png"),
      softEdges: true,
    });
    expect(canvas).toBeNull();
  });
});
