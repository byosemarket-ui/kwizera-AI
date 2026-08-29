import { describe, expect, it } from "vitest";
import { decodePngRgba, encodeRgbaPng, buildThumbnailPng } from "../../../../ai/creative-workspace/png-pixels.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("PNG pixel decode", () => {
  it("decodes the standard 1x1 PNG and round-trips a solid thumbnail", () => {
    const decoded = decodePngRgba(PNG_1X1);
    expect(decoded).toBeTruthy();
    expect(decoded?.width).toBe(1);
    expect(decoded?.height).toBe(1);
    expect(decoded?.rgba.length).toBe(4);

    const rgba = Buffer.from([10, 20, 230, 255, 10, 20, 230, 255, 10, 20, 230, 255, 10, 20, 230, 255]);
    const png = encodeRgbaPng(2, 2, rgba);
    const again = decodePngRgba(png);
    expect(again?.width).toBe(2);
    expect(again?.rgba[2]).toBe(230);
    const thumb = buildThumbnailPng(again!);
    expect(thumb.width).toBe(2);
    expect(thumb.png.length).toBeGreaterThan(20);
  });
});
