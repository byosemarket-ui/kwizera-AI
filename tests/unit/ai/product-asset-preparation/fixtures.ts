/**
 * Deterministic PNG fixtures for image preparation tests.
 * White background + solid product rectangle preserves identifiable product pixels.
 */
import { encodeRgbaPng } from "../../../../ai/creative-workspace/png-pixels.js";

export function productOnWhitePngBase64(width = 64, height = 64): string {
  const rgba = Buffer.alloc(width * height * 4, 255);
  const left = Math.floor(width * 0.25);
  const right = Math.floor(width * 0.75);
  const top = Math.floor(height * 0.2);
  const bottom = Math.floor(height * 0.8);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = 120; // brown-ish product
      rgba[i + 1] = 72;
      rgba[i + 2] = 40;
      rgba[i + 3] = 255;
    }
  }
  return encodeRgbaPng(width, height, rgba).toString("base64");
}

export function complexBackgroundProductPngBase64(width = 80, height = 80): string {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      // noisy room-like background
      rgba[i] = 180 + ((x * 3 + y) % 40);
      rgba[i + 1] = 160 + ((x + y * 5) % 50);
      rgba[i + 2] = 140 + ((x * 7) % 60);
      rgba[i + 3] = 255;
    }
  }
  const left = Math.floor(width * 0.3);
  const right = Math.floor(width * 0.7);
  const top = Math.floor(height * 0.25);
  const bottom = Math.floor(height * 0.75);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = 30;
      rgba[i + 1] = 30;
      rgba[i + 2] = 30;
      rgba[i + 3] = 255;
    }
  }
  return encodeRgbaPng(width, height, rgba).toString("base64");
}
