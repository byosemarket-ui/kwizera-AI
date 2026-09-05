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
  if (aspectRatio === "4:5" || /portrait|4:5/i.test(platform ?? "")) {
    return { top: 0.1, bottom: 0.14, left: 0.06, right: 0.06 };
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

export function regionOverlapsProduct(
  region: PlacementRegion,
  productCentered: boolean,
  productOccupiedRegion?: { x: number; y: number; width: number; height: number } | null,
): boolean {
  const point = REGION_COORDS[region];
  if (productOccupiedRegion
    && productOccupiedRegion.width > 0
    && productOccupiedRegion.height > 0) {
    const x0 = productOccupiedRegion.x;
    const y0 = productOccupiedRegion.y;
    const x1 = productOccupiedRegion.x + productOccupiedRegion.width;
    const y1 = productOccupiedRegion.y + productOccupiedRegion.height;
    return point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1;
  }
  if (!productCentered) return region === "center";
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
  productOccupiedRegion?: { x: number; y: number; width: number; height: number } | null;
  /** STEP 10 — preferred sides from scene composition (product bias). */
  preferredTextSides?: Array<"left" | "right" | "top" | "bottom">;
}): PlacementRegion {
  const occupied = new Set(input.occupiedRegions ?? []);
  const productCx = input.productOccupiedRegion
    ? input.productOccupiedRegion.x + input.productOccupiedRegion.width / 2
    : 0.5;
  const productCy = input.productOccupiedRegion
    ? input.productOccupiedRegion.y + input.productOccupiedRegion.height / 2
    : 0.5;
  const biasLeft = productCx < 0.42;
  const biasRight = productCx > 0.58;
  const biasTop = productCy < 0.4;
  const actionRole = input.role === "cta" || input.role === "price" || input.role === "discount"
    || input.role === "previousPrice" || input.role === "promotion";
  const titleRole = input.role === "headline" || input.role === "hook" || input.role === "title"
    || input.role === "productName";

  let candidates: PlacementRegion[];
  if (input.preferredTextSides?.length) {
    candidates = [];
    for (const side of input.preferredTextSides) {
      if (side === "top") candidates.push("top-center", "upper-center", "top-left", "top-right");
      if (side === "bottom") candidates.push("bottom-center", "lower-center", "bottom-left", "bottom-right");
      if (side === "left") candidates.push("center-left", "top-left", "bottom-left");
      if (side === "right") candidates.push("center-right", "top-right", "bottom-right");
    }
    if (actionRole) candidates = ["bottom-center", "lower-center", ...candidates];
  } else if (actionRole) {
    candidates = biasLeft
      ? ["bottom-center", "bottom-right", "lower-center", "bottom-left"]
      : biasRight
        ? ["bottom-center", "bottom-left", "lower-center", "bottom-right"]
        : ["bottom-center", "lower-center", "bottom-left", "bottom-right"];
  } else if (titleRole) {
    candidates = biasLeft
      ? ["top-right", "top-center", "upper-center", "center-right", "top-left"]
      : biasRight
        ? ["top-left", "top-center", "upper-center", "center-left", "top-right"]
        : biasTop
          ? ["bottom-center", "lower-center", "top-center", "upper-center"]
          : input.productCentered || input.hierarchy <= 2
            ? ["top-center", "upper-center", "top-left", "top-right", "bottom-center"]
            : ["upper-center", "top-center", "center-left", "top-left"];
  } else {
    candidates = biasLeft
      ? ["center-right", "top-right", "bottom-right", "top-center", "bottom-center"]
      : biasRight
        ? ["center-left", "top-left", "bottom-left", "top-center", "bottom-center"]
        : ["bottom-center", "lower-center", "top-center"];
  }

  for (const region of candidates) {
    if (occupied.has(region)) continue;
    if (regionOverlapsProduct(region, input.productCentered, input.productOccupiedRegion)) continue;
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
