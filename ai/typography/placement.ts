import type { PlacementRegion, TextAlignment, TextRole } from "./types.js";

export interface SafeZone {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function platformSafeZone(platform?: string, aspectRatio?: string): SafeZone {
  const vertical = aspectRatio === "9:16" || /tiktok|reel|short/i.test(platform ?? "");
  if (vertical) {
    return { top: 0.12, bottom: 0.18, left: 0.06, right: 0.06 };
  }
  if (aspectRatio === "1:1") {
    return { top: 0.08, bottom: 0.10, left: 0.06, right: 0.06 };
  }
  return { top: 0.08, bottom: 0.10, left: 0.05, right: 0.05 };
}

export const REGION_COORDS: Record<PlacementRegion, { x: number; y: number; alignment: TextAlignment }> = {
  "top-left": { x: 0.08, y: 0.12, alignment: "left" },
  "top-center": { x: 0.5, y: 0.12, alignment: "center" },
  "top-right": { x: 0.92, y: 0.12, alignment: "right" },
  "upper-center": { x: 0.5, y: 0.22, alignment: "center" },
  center: { x: 0.5, y: 0.5, alignment: "center" },
  "center-left": { x: 0.1, y: 0.5, alignment: "left" },
  "center-right": { x: 0.9, y: 0.5, alignment: "right" },
  "lower-center": { x: 0.5, y: 0.72, alignment: "center" },
  "bottom-left": { x: 0.08, y: 0.86, alignment: "left" },
  "bottom-center": { x: 0.5, y: 0.86, alignment: "center" },
  "bottom-right": { x: 0.92, y: 0.86, alignment: "right" },
};

const PRODUCT_CENTER_BOX = { x0: 0.28, y0: 0.28, x1: 0.72, y1: 0.72 };

export function regionOverlapsProduct(region: PlacementRegion, productCentered: boolean): boolean {
  if (!productCentered) return region === "center";
  const point = REGION_COORDS[region];
  return point.x >= PRODUCT_CENTER_BOX.x0
    && point.x <= PRODUCT_CENTER_BOX.x1
    && point.y >= PRODUCT_CENTER_BOX.y0
    && point.y <= PRODUCT_CENTER_BOX.y1;
}

export function clampToSafeZone(region: PlacementRegion, zone: SafeZone): { x: number; y: number; alignment: TextAlignment } {
  const base = REGION_COORDS[region];
  return {
    alignment: base.alignment,
    x: Math.min(1 - zone.right, Math.max(zone.left, base.x)),
    y: Math.min(1 - zone.bottom, Math.max(zone.top, base.y)),
  };
}

export function choosePlacement(input: {
  role: TextRole;
  productCentered: boolean;
  backgroundComplexity?: string;
  occupiedRegions?: PlacementRegion[];
  hierarchy: number;
}): PlacementRegion {
  const occupied = new Set(input.occupiedRegions ?? []);
  const preferTop = input.productCentered || input.hierarchy <= 2;
  const candidates: PlacementRegion[] = preferTop
    ? input.role === "cta" || input.role === "price" || input.role === "discount" || input.role === "previousPrice" || input.role === "promotion"
      ? ["bottom-center", "lower-center", "bottom-left", "bottom-right"]
      : ["top-center", "upper-center", "top-left", "top-right", "bottom-center"]
    : input.role === "headline" || input.role === "hook" || input.role === "title"
      ? ["upper-center", "top-center", "center-left", "top-left"]
      : ["bottom-center", "lower-center", "top-center"];

  for (const region of candidates) {
    if (occupied.has(region)) continue;
    if (regionOverlapsProduct(region, input.productCentered)) continue;
    return region;
  }
  return input.productCentered ? "top-center" : "bottom-center";
}

/** Map intelligent regions onto the existing FFmpeg layer positions (Step 1 compatibility). */
export function toLegacyPosition(region: PlacementRegion): "top" | "bottom" | "center" {
  if (region.startsWith("bottom") || region === "lower-center") return "bottom";
  if (region === "center" || region.startsWith("center-")) return "center";
  return "top";
}
