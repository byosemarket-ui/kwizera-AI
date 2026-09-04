/**
 * STEP 3 — adaptive text sizing for hierarchy + format + placement zone.
 * Extends fitting.ts; does not replace placement/font discovery.
 */
import type { HierarchyLevel, PlacementRegion, TextRole } from "./types.js";
import { estimateCharWidth, wrapText } from "./fitting.js";
import { preferPriceSafeWrap } from "./price-typography.js";
import { REGION_COORDS } from "./placement.js";

function aspectScale(aspectRatio: string): number {
  if (aspectRatio === "9:16") return 1.05;
  if (aspectRatio === "1:1") return 1;
  if (aspectRatio === "4:5") return 1.02;
  return 0.95; // 16:9 — slightly tighter vertical budget
}

function hierarchyScale(level: HierarchyLevel): number {
  switch (level) {
    case "PRIMARY":
      return 0.058;
    case "CRITICAL_ACTION":
      return 0.05;
    case "SECONDARY":
      return 0.044;
    case "SUPPORTING":
      return 0.036;
    case "MINOR":
    default:
      return 0.03;
  }
}

function zoneWidthFraction(region: PlacementRegion, alignment: string): number {
  const point = REGION_COORDS[region];
  if (alignment === "left" || region.includes("left")) return Math.min(0.78, 1 - point.x - 0.06);
  if (alignment === "right" || region.includes("right")) return Math.min(0.78, point.x - 0.06);
  return 0.82;
}

export function adaptiveFitText(input: {
  text: string;
  role: TextRole;
  hierarchyLevel: HierarchyLevel;
  width: number;
  height: number;
  aspectRatio: string;
  region: PlacementRegion;
  alignment: "left" | "center" | "right";
  productCentered?: boolean;
  itemCountInScene?: number;
}): { lines: string[]; fontSizePx: number; maxLines: number; maxWidthPx: number } {
  const minDim = Math.min(input.width, input.height);
  const wordCount = input.text.trim().split(/\s+/).filter(Boolean).length;
  const densityPenalty = (input.itemCountInScene ?? 1) > 3 ? 0.9 : (input.itemCountInScene ?? 1) > 2 ? 0.95 : 1;
  const lengthPenalty = wordCount > 12 ? 0.82 : wordCount > 8 ? 0.9 : wordCount > 4 ? 0.95 : 1;
  const productPenalty = input.productCentered && (input.region === "center" || input.region.startsWith("center-")) ? 0.9 : 1;

  let maxLines = input.hierarchyLevel === "PRIMARY" || input.hierarchyLevel === "CRITICAL_ACTION" ? 2 : 3;
  if (input.role === "cta" || input.role === "price" || input.role === "discount") maxLines = 2;
  if (input.role === "website" || input.role === "phone") maxLines = 1;
  if (wordCount > 14) maxLines = Math.min(4, maxLines + 1);

  const maxWidthPx = Math.round(input.width * zoneWidthFraction(input.region, input.alignment));
  const preferred = Math.round(
    minDim
    * hierarchyScale(input.hierarchyLevel)
    * aspectScale(input.aspectRatio)
    * densityPenalty
    * lengthPenalty
    * productPenalty,
  );
  const minSize = Math.max(
    input.hierarchyLevel === "MINOR" ? 12 : 14,
    Math.round(minDim * (input.hierarchyLevel === "PRIMARY" ? 0.032 : 0.026)),
  );
  const maxSize = Math.round(minDim * (input.hierarchyLevel === "PRIMARY" ? 0.09 : 0.07));

  let fontSizePx = Math.min(maxSize, Math.max(minSize, preferred));
  let lines = preferPriceSafeWrap(wrapText(input.text, maxWidthPx, fontSizePx, maxLines));

  while (fontSizePx > minSize) {
    const fittedLen = lines.join(" ").length;
    const sourceLen = input.text.replace(/\s+/g, " ").trim().length;
    const overflow = fittedLen < sourceLen && lines.length >= maxLines;
    const tooWide = lines.some((line) => line.length * estimateCharWidth(fontSizePx) > maxWidthPx);
    if (!overflow && !tooWide) break;
    fontSizePx -= 2;
    lines = preferPriceSafeWrap(wrapText(input.text, maxWidthPx, fontSizePx, maxLines));
  }

  // Short primary can grow slightly if space remains.
  if (
    (input.hierarchyLevel === "PRIMARY" || input.hierarchyLevel === "CRITICAL_ACTION")
    && wordCount <= 3
    && lines.length === 1
    && fontSizePx < maxSize
  ) {
    const candidate = Math.min(maxSize, fontSizePx + 4);
    const probe = wrapText(input.text, maxWidthPx, candidate, 1);
    if (probe.length === 1 && probe[0]!.length * estimateCharWidth(candidate) <= maxWidthPx) {
      fontSizePx = candidate;
      lines = probe;
    }
  }

  return { lines, fontSizePx, maxLines, maxWidthPx };
}

export function estimateBoundingArea(input: {
  lines: string[];
  fontSizePx: number;
  maxWidthPx: number;
  normalizedX: number;
  normalizedY: number;
  alignment: "left" | "center" | "right";
  frameWidth: number;
  frameHeight: number;
}): { x: number; y: number; width: number; height: number } {
  const lineH = input.fontSizePx * 1.22;
  const longest = input.lines.reduce((max, line) => Math.max(max, line.length), 0);
  const textW = Math.min(input.maxWidthPx, Math.max(input.fontSizePx, longest * estimateCharWidth(input.fontSizePx)));
  const textH = Math.max(lineH, input.lines.length * lineH);
  const width = textW / input.frameWidth;
  const height = textH / input.frameHeight;
  let x = input.normalizedX;
  if (input.alignment === "center") x = input.normalizedX - width / 2;
  if (input.alignment === "right") x = input.normalizedX - width;
  return {
    x: Math.min(0.98, Math.max(0.02, x)),
    y: Math.min(0.98, Math.max(0.02, input.normalizedY)),
    width: Math.min(0.95, Math.max(0.05, width)),
    height: Math.min(0.5, Math.max(0.03, height)),
  };
}
