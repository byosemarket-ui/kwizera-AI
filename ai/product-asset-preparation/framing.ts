/**
 * STEP 6 — safe product framing / crop preparation (format-aware).
 * Prepares composition metadata for later motion; does not render video.
 * Never invents destructive crops that cut essential product bounds.
 */
import type { BoundingBox } from "./types.js";

/** Formats known to production + feed composition (4:5 prep-only until video types expand). */
export type PrepAspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export const PREP_ASPECT_RATIOS: PrepAspectRatio[] = ["9:16", "16:9", "1:1", "4:5"];

export interface NormalizedRect {
  /** 0–1 relative to source image */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FormatFramingPlan {
  aspectRatio: PrepAspectRatio;
  targetRatio: number;
  /** Recommended crop window in source-normalized coords. */
  recommendedCrop: NormalizedRect;
  /** Product region that must remain fully inside any crop. */
  protectedProductArea: NormalizedRect;
  productCenter: { x: number; y: number };
  /** Max scale factor before product edges would be clipped. */
  maxSafeEnlargement: number;
  /** Suggested zoom range for later motion (1 = fit protected area). */
  safeZoomRange: { min: number; max: number };
  /** Prefer letterbox/pillarbox composition instead of aggressive crop. */
  preferSafeComposition: boolean;
  edgeProtection: { top: number; bottom: number; left: number; right: number };
  /** Space useful for typography (normalized). */
  negativeSpace: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  warnings: string[];
  confidence: number;
  analysisBasis: "measured-bbox" | "estimated-center" | "unavailable";
}

export interface FramingInspection {
  sourceWidth: number;
  sourceHeight: number;
  orientation: "landscape" | "portrait" | "square" | "unknown";
  aspectRatioValue: number | null;
  productBounds: NormalizedRect;
  productCentered: boolean;
  nearEdge: boolean;
  formats: Record<PrepAspectRatio, FormatFramingPlan>;
  unsafeDestructiveCropRejected: boolean;
}

const ASPECT_VALUE: Record<PrepAspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
};

const EDGE_MARGIN = 0.04;
const PRODUCT_PAD = 0.06;

export function normalizeBoundingBox(
  box: BoundingBox | undefined,
  canvasWidth: number,
  canvasHeight: number,
): NormalizedRect | null {
  if (!box || !canvasWidth || !canvasHeight) return null;
  if (box.width <= 0 || box.height <= 0) return null;
  return {
    x: clamp01(box.x / canvasWidth),
    y: clamp01(box.y / canvasHeight),
    width: clamp01(box.width / canvasWidth),
    height: clamp01(box.height / canvasHeight),
  };
}

/** Default product protection when no measured bbox exists — center 60% box. */
export function estimatedProductBounds(): NormalizedRect {
  return { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
}

export function buildFramingInspection(input: {
  width?: number;
  height?: number;
  /** Pixel bbox on the same coordinate space as width/height when measured. */
  productBox?: BoundingBox | null;
  visibilityCutoff?: boolean;
  framingNote?: string;
}): FramingInspection {
  const width = input.width && input.width > 0 ? input.width : 0;
  const height = input.height && input.height > 0 ? input.height : 0;
  const orientation = !width || !height
    ? "unknown"
    : Math.abs(width - height) / Math.max(width, height) < 0.05
      ? "square"
      : width > height
        ? "landscape"
        : "portrait";
  const aspectRatioValue = width && height ? Number((width / height).toFixed(4)) : null;

  const measured = width && height ? normalizeBoundingBox(input.productBox ?? undefined, width, height) : null;
  const productBounds = measured ?? estimatedProductBounds();
  const analysisBasis: FormatFramingPlan["analysisBasis"] = measured ? "measured-bbox" : width && height ? "estimated-center" : "unavailable";

  const centerX = productBounds.x + productBounds.width / 2;
  const centerY = productBounds.y + productBounds.height / 2;
  const productCentered = centerX > 0.35 && centerX < 0.65 && centerY > 0.35 && centerY < 0.65;
  const nearEdge = productBounds.x < EDGE_MARGIN
    || productBounds.y < EDGE_MARGIN
    || productBounds.x + productBounds.width > 1 - EDGE_MARGIN
    || productBounds.y + productBounds.height > 1 - EDGE_MARGIN
    || Boolean(input.visibilityCutoff)
    || /edge|cut-?off/i.test(input.framingNote ?? "");

  const formats = {} as Record<PrepAspectRatio, FormatFramingPlan>;
  let unsafeDestructiveCropRejected = false;
  for (const aspect of PREP_ASPECT_RATIOS) {
    const plan = buildFormatFraming({
      aspectRatio: aspect,
      productBounds,
      productCentered,
      nearEdge,
      analysisBasis,
    });
    formats[aspect] = plan;
    if (plan.preferSafeComposition && plan.warnings.some((w) => /destructive|cut/i.test(w))) {
      unsafeDestructiveCropRejected = true;
    }
  }

  return {
    sourceWidth: width,
    sourceHeight: height,
    orientation,
    aspectRatioValue,
    productBounds,
    productCentered,
    nearEdge,
    formats,
    unsafeDestructiveCropRejected,
  };
}

function buildFormatFraming(input: {
  aspectRatio: PrepAspectRatio;
  productBounds: NormalizedRect;
  productCentered: boolean;
  nearEdge: boolean;
  analysisBasis: FormatFramingPlan["analysisBasis"];
}): FormatFramingPlan {
  const targetRatio = ASPECT_VALUE[input.aspectRatio];
  const protectedProductArea = padRect(input.productBounds, PRODUCT_PAD);
  const productCenter = {
    x: input.productBounds.x + input.productBounds.width / 2,
    y: input.productBounds.y + input.productBounds.height / 2,
  };

  const coverCrop = coverCropAroundCenter(productCenter, targetRatio);
  const containsProduct = rectContains(coverCrop, protectedProductArea);
  const warnings: string[] = [];
  let recommendedCrop = coverCrop;
  let preferSafeComposition = false;
  let maxSafeEnlargement = 1.35;

  if (!containsProduct) {
    // Expand crop until product fits, or fall back to safe composition (no destructive cut).
    const expanded = expandCropToContain(coverCrop, protectedProductArea, targetRatio);
    if (expanded && rectContains(expanded, protectedProductArea)) {
      recommendedCrop = expanded;
      warnings.push("Expanded crop to protect full product bounds.");
      maxSafeEnlargement = 1.15;
    } else {
      recommendedCrop = fitContainingCrop(protectedProductArea, targetRatio);
      preferSafeComposition = true;
      maxSafeEnlargement = 1.05;
      warnings.push("Rejected destructive crop that would cut product; prefer safe composition / letterboxing.");
    }
  }

  if (input.nearEdge) {
    preferSafeComposition = true;
    maxSafeEnlargement = Math.min(maxSafeEnlargement, 1.08);
    warnings.push("Product near edge — limit enlargement and protect boundaries.");
  }

  if (!input.productCentered && input.aspectRatio === "9:16") {
    warnings.push("Off-center source for vertical format — keep product fully visible.");
  }

  const negativeSpace = {
    top: clamp01(recommendedCrop.y),
    bottom: clamp01(1 - (recommendedCrop.y + recommendedCrop.height)),
    left: clamp01(recommendedCrop.x),
    right: clamp01(1 - (recommendedCrop.x + recommendedCrop.width)),
  };

  // Prefer typography in the larger empty band outside the protected product.
  const outsideTop = clamp01(protectedProductArea.y);
  const outsideBottom = clamp01(1 - (protectedProductArea.y + protectedProductArea.height));
  negativeSpace.top = Math.max(negativeSpace.top, outsideTop * 0.85);
  negativeSpace.bottom = Math.max(negativeSpace.bottom, outsideBottom * 0.85);

  const edgeProtection = {
    top: Math.max(0.02, protectedProductArea.y - recommendedCrop.y),
    bottom: Math.max(0.02, (recommendedCrop.y + recommendedCrop.height) - (protectedProductArea.y + protectedProductArea.height)),
    left: Math.max(0.02, protectedProductArea.x - recommendedCrop.x),
    right: Math.max(0.02, (recommendedCrop.x + recommendedCrop.width) - (protectedProductArea.x + protectedProductArea.width)),
  };

  const confidence = input.analysisBasis === "measured-bbox" ? 82 : input.analysisBasis === "estimated-center" ? 58 : 30;

  return {
    aspectRatio: input.aspectRatio,
    targetRatio: Number(targetRatio.toFixed(4)),
    recommendedCrop,
    protectedProductArea,
    productCenter,
    maxSafeEnlargement,
    safeZoomRange: { min: 1, max: Number(maxSafeEnlargement.toFixed(3)) },
    preferSafeComposition,
    edgeProtection,
    negativeSpace,
    warnings,
    confidence,
    analysisBasis: input.analysisBasis,
  };
}

function coverCropAroundCenter(center: { x: number; y: number }, targetRatio: number): NormalizedRect {
  // Cover crop of the unit square with target aspect, centered on product.
  let width: number;
  let height: number;
  if (targetRatio < 1) {
    width = targetRatio;
    height = 1;
  } else if (targetRatio > 1) {
    width = 1;
    height = 1 / targetRatio;
  } else {
    width = 1;
    height = 1;
  }
  const x = clamp01(center.x - width / 2);
  const y = clamp01(center.y - height / 2);
  return {
    x: Math.min(x, 1 - width),
    y: Math.min(y, 1 - height),
    width,
    height,
  };
}

function expandCropToContain(crop: NormalizedRect, product: NormalizedRect, targetRatio: number): NormalizedRect | null {
  let x0 = Math.min(crop.x, product.x);
  let y0 = Math.min(crop.y, product.y);
  let x1 = Math.max(crop.x + crop.width, product.x + product.width);
  let y1 = Math.max(crop.y + crop.height, product.y + product.height);
  let width = x1 - x0;
  let height = y1 - y0;
  const current = width / height;
  if (current > targetRatio) {
    height = width / targetRatio;
  } else {
    width = height * targetRatio;
  }
  if (width > 1.001 || height > 1.001) return null;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return {
    x: clamp01(cx - width / 2),
    y: clamp01(cy - height / 2),
    width,
    height,
  };
}

function fitContainingCrop(product: NormalizedRect, targetRatio: number): NormalizedRect {
  let width = product.width;
  let height = product.height;
  const current = width / Math.max(0.001, height);
  if (current > targetRatio) {
    height = width / targetRatio;
  } else {
    width = height * targetRatio;
  }
  width = Math.min(1, width);
  height = Math.min(1, height);
  const cx = product.x + product.width / 2;
  const cy = product.y + product.height / 2;
  return {
    x: clamp01(Math.min(cx - width / 2, 1 - width)),
    y: clamp01(Math.min(cy - height / 2, 1 - height)),
    width,
    height,
  };
}

function padRect(rect: NormalizedRect, pad: number): NormalizedRect {
  const x = clamp01(rect.x - pad);
  const y = clamp01(rect.y - pad);
  const x1 = clamp01(rect.x + rect.width + pad);
  const y1 = clamp01(rect.y + rect.height + pad);
  return { x, y, width: Math.max(0.05, x1 - x), height: Math.max(0.05, y1 - y) };
}

function rectContains(outer: NormalizedRect, inner: NormalizedRect): boolean {
  return outer.x <= inner.x + 0.001
    && outer.y <= inner.y + 0.001
    && outer.x + outer.width >= inner.x + inner.width - 0.001
    && outer.y + outer.height >= inner.y + inner.height - 0.001;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
