/**
 * STEP 9 — Smart Camera, framing & format adaptation for AI PRODUCT MOTION.
 * Consumes STEP 6 framing + STEP 8 motion intent; produces subject-aware crop/zoom
 * for the existing FFmpeg still→zoompan path. Does not create a parallel renderer.
 */
import type { FormatFramingPlan, FramingInspection, NormalizedRect, PrepAspectRatio } from "../product-asset-preparation/framing.js";
import type { ProductionImageRole, ProductionRoleDecision } from "../product-asset-preparation/production-roles.js";
import type { DirectedMotionType, MotionRenderParams } from "./motion-direction.js";
import type { VideoAspectRatio, VideoTimelineClip } from "./types.js";

export type SmartCameraMode =
  | "FULL_PRODUCT"
  | "PRODUCT_HERO"
  | "PRODUCT_REVEAL"
  | "DETAIL_CLOSE_UP"
  | "TOP_DETAIL"
  | "SIDE_DETAIL"
  | "FEATURE_FOCUS"
  | "WIDE_CONTEXT"
  | "LEFT_FOCUS"
  | "RIGHT_FOCUS"
  | "CENTER_FOCUS"
  | "SMART_AUTO";

export type CameraValidationStatus = "valid" | "corrected" | "fallback";

export interface CameraViewport {
  /** Normalized 0–1 in source image space (logical composition window). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraFocusPoint {
  x: number;
  y: number;
}

export interface ReservedTextZones {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SmartCameraPlan {
  projectId?: string;
  sceneId: string;
  assetId: string;
  mode: SmartCameraMode;
  targetFormat: PrepAspectRatio;
  sourceWidth: number;
  sourceHeight: number;
  sourceOrientation: FramingInspection["orientation"];
  protectedProductBounds: NormalizedRect;
  initialViewport: CameraViewport;
  finalViewport: CameraViewport;
  focusPoint: CameraFocusPoint;
  /** 0–1 slide along excess after scale-to-cover (FFmpeg crop x/y). */
  cropFocusX: number;
  cropFocusY: number;
  zoomStart: number;
  zoomEnd: number;
  panAllowed: boolean;
  productVisibilityRequired: boolean;
  minimumMargin: number;
  occupancyTarget: number;
  reservedTextZones: ReservedTextZones;
  validationStatus: CameraValidationStatus;
  fallbackUsed: boolean;
  safetyAdjusted: boolean;
  reason: string;
  /** Bridge into existing STEP 8 / FFmpeg motionParams. */
  renderParams: MotionRenderParams & { cropFocusX: number; cropFocusY: number };
}

const FORMAT_KEY: Record<VideoAspectRatio | PrepAspectRatio, PrepAspectRatio> = {
  "9:16": "9:16",
  "16:9": "16:9",
  "1:1": "1:1",
  "4:5": "4:5",
};

/** Occupancy targets differ by format + mode (not one hardcoded %). */
export function occupancyTargetFor(input: {
  format: PrepAspectRatio;
  mode: SmartCameraMode;
  productCategory?: string | null;
}): number {
  const cat = String(input.productCategory ?? "").toLowerCase();
  let base = 0.42;
  if (input.format === "9:16") base = 0.48;
  else if (input.format === "4:5") base = 0.46;
  else if (input.format === "1:1") base = 0.44;
  else if (input.format === "16:9") base = 0.36;

  if (/shoe|boot|footwear|sneaker/.test(cat)) base += 0.04;
  if (/phone|watch|jewelry|small/.test(cat)) base += 0.06;
  if (/bag|clothing|apparel|furniture|wide/.test(cat)) base -= 0.03;

  if (input.mode === "DETAIL_CLOSE_UP" || input.mode === "TOP_DETAIL" || input.mode === "SIDE_DETAIL") {
    return clamp(base + 0.22, 0.55, 0.85);
  }
  if (input.mode === "PRODUCT_HERO" || input.mode === "PRODUCT_REVEAL") {
    return clamp(base + 0.08, 0.38, 0.72);
  }
  if (input.mode === "WIDE_CONTEXT") {
    return clamp(base - 0.1, 0.22, 0.45);
  }
  if (input.mode === "FULL_PRODUCT" || input.mode === "CENTER_FOCUS" || input.mode === "SMART_AUTO") {
    return clamp(base, 0.32, 0.62);
  }
  return clamp(base, 0.3, 0.7);
}

export function chooseSmartCameraMode(input: {
  purpose: string;
  role?: ProductionImageRole | string | null;
  directed?: DirectedMotionType | string | null;
  order: number;
  isLast: boolean;
}): SmartCameraMode {
  // Creative plans may concatenate beats ("HOOK|REVEAL|FEATURE|…") — use primary token.
  const purposeRaw = input.purpose.toUpperCase();
  const purpose = purposeRaw.split(/[|/]+/)[0]?.trim() || purposeRaw;
  const role = String(input.role ?? "").toUpperCase();
  const directed = String(input.directed ?? "").toUpperCase();

  if (input.isLast || purpose === "CTA" || /^(CTA|BRAND|COMPANY|CONTACT)/.test(purpose)) {
    return "FULL_PRODUCT";
  }
  // Opening hero always wins over a DETAIL role on the same asset.
  if (input.order <= 1 || /^(HOOK|PRODUCT_REVEAL|INTRO|HERO)$/.test(purpose) || purpose === "PRODUCT_REVEAL") {
    if (directed === "HERO_REVEAL" || purpose === "PRODUCT_REVEAL" || purpose.includes("REVEAL")) return "PRODUCT_REVEAL";
    if (role === "HERO_PRODUCT" || role === "MAIN_REVEAL" || input.order <= 1 || purpose === "HOOK") return "PRODUCT_HERO";
  }
  if (role === "DETAIL_CLOSE_UP" || directed === "DETAIL_PUSH" || purpose === "DETAIL" || purpose === "DETAIL_SCENE" || /^DETAIL/.test(purpose)) {
    if (/TOP|UPPER/.test(purpose) || /TOP/.test(role)) return "TOP_DETAIL";
    if (/SIDE|LATERAL/.test(purpose) || /SIDE|ALTERNATE/.test(role)) return "SIDE_DETAIL";
    return "DETAIL_CLOSE_UP";
  }
  if (role === "WIDE_PRODUCT_VIEW" || /^(WIDE|LIFESTYLE|CONTEXT|VISUAL_EXPLORATION|EXPLORATION)/.test(purpose)) {
    return "WIDE_CONTEXT";
  }
  if (/^(FEATURE|KEY_MESSAGE|MESSAGE|PRICE|PRICE_OR_OFFER)/.test(purpose) || directed === "PRODUCT_FOCUS") {
    return "FEATURE_FOCUS";
  }
  if (role === "HERO_PRODUCT" || role === "MAIN_REVEAL" || /^(HOOK|REVEAL|INTRO|HERO)/.test(purpose)) {
    if (directed === "HERO_REVEAL" || /REVEAL/.test(purpose)) return "PRODUCT_REVEAL";
    return "PRODUCT_HERO";
  }
  if (role.includes("LEFT") || /^LEFT/.test(purpose)) return "LEFT_FOCUS";
  if (role.includes("RIGHT") || /^RIGHT/.test(purpose)) return "RIGHT_FOCUS";
  return "SMART_AUTO";
}

export function buildSmartCameraPlan(input: {
  projectId?: string;
  clip: VideoTimelineClip;
  aspectRatio: VideoAspectRatio | PrepAspectRatio;
  framingInspection?: FramingInspection | null;
  role?: ProductionRoleDecision | null;
  motionParams?: MotionRenderParams | null;
  directedType?: DirectedMotionType | string | null;
  productCategory?: string | null;
  isLast?: boolean;
  previousPlan?: SmartCameraPlan | null;
}): SmartCameraPlan {
  const format = FORMAT_KEY[input.aspectRatio] ?? "9:16";
  const framing = input.framingInspection?.formats[format]
    ?? input.framingInspection?.formats["9:16"]
    ?? null;
  const mode = chooseSmartCameraMode({
    purpose: input.clip.purpose,
    role: input.role?.role ?? input.clip.imageRole,
    directed: input.directedType ?? input.motionParams?.directedType,
    order: input.clip.order,
    isLast: Boolean(input.isLast),
  });

  const protectedBounds = framing?.protectedProductArea
    ?? input.framingInspection?.productBounds
    ?? { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };

  const reserved: ReservedTextZones = {
    top: Math.max(0.08, framing?.negativeSpace.top ?? 0.1),
    bottom: Math.max(0.1, framing?.negativeSpace.bottom ?? 0.12),
    left: Math.max(0.04, framing?.negativeSpace.left ?? 0.06),
    right: Math.max(0.04, framing?.negativeSpace.right ?? 0.06),
  };

  const productVisibilityRequired = mode === "FULL_PRODUCT"
    || mode === "PRODUCT_HERO"
    || mode === "PRODUCT_REVEAL"
    || mode === "WIDE_CONTEXT"
    || mode === "SMART_AUTO"
    || mode === "CENTER_FOCUS";

  const occupancyTarget = occupancyTargetFor({
    format,
    mode,
    productCategory: input.productCategory,
  });

  const focus = computeFocusPoint({
    mode,
    productCenter: framing?.productCenter
      ?? {
        x: protectedBounds.x + protectedBounds.width / 2,
        y: protectedBounds.y + protectedBounds.height / 2,
      },
    protectedBounds,
    reserved,
  });

  const cropFocus = computeCoverCropFocus({
    focus,
    reserved,
    mode,
    preferSafe: Boolean(framing?.preferSafeComposition),
  });

  const safeMax = Math.min(1.25, framing?.maxSafeEnlargement ?? 1.12);
  const motionZoomRaw = input.motionParams?.maxZoom ?? 1.06;
  const motionZoom = Number.isFinite(motionZoomRaw) && motionZoomRaw >= 1 ? Math.min(motionZoomRaw, 1.25) : 1.06;
  let zoomEnd = Math.min(safeMax, Math.max(1, motionZoom));
  let zoomStart = 1;
  let safetyAdjusted = Boolean(input.motionParams?.safetyAdjusted) || motionZoomRaw > safeMax;
  let fallbackUsed = !framing || Boolean(input.motionParams?.fallbackUsed);
  let validationStatus: CameraValidationStatus = framing ? "valid" : "fallback";
  let reason = framing
    ? `Format ${format} composition for ${mode}.`
    : "Framing unavailable — deterministic safe full-product composition.";
  if (motionZoomRaw > 1.25 || !Number.isFinite(motionZoomRaw)) {
    safetyAdjusted = true;
    reason = `${reason} Clamped unsafe motion zoom.`;
  }

  // Product too small → encourage stronger (still safe) end zoom.
  const approxOccupancy = protectedBounds.width * protectedBounds.height;
  if (productVisibilityRequired && approxOccupancy < occupancyTarget * 0.55 && zoomEnd < safeMax) {
    zoomEnd = Math.min(safeMax, Math.max(zoomEnd, 1 + (occupancyTarget - approxOccupancy) * 0.35));
    safetyAdjusted = true;
    reason = `${reason} Raised zoom for product presence.`;
  }

  // Product too large / edge risk → clamp zoom.
  if (framing?.preferSafeComposition || (input.framingInspection?.nearEdge && productVisibilityRequired)) {
    zoomEnd = Math.min(zoomEnd, Math.max(1.02, safeMax));
    safetyAdjusted = true;
  }

  if (mode === "DETAIL_CLOSE_UP" || mode === "TOP_DETAIL" || mode === "SIDE_DETAIL") {
    zoomStart = Math.min(1.02, zoomEnd);
    zoomEnd = Math.min(safeMax, Math.max(zoomEnd, Math.min(1.12, safeMax)));
  }
  if (mode === "WIDE_CONTEXT") {
    zoomEnd = Math.min(zoomEnd, 1.04);
    zoomStart = 1;
  }

  // Continuity: avoid abrupt occupancy jumps vs previous scene when both are full-product.
  if (input.previousPlan && productVisibilityRequired && input.previousPlan.productVisibilityRequired) {
    const prev = input.previousPlan.zoomEnd;
    if (Math.abs(zoomEnd - prev) > 0.08) {
      zoomEnd = Number((prev + (zoomEnd - prev) * 0.55).toFixed(3));
      safetyAdjusted = true;
      reason = `${reason} Smoothed zoom continuity from prior scene.`;
    }
  }

  let initialViewport = viewportAroundFocus({
    focus,
    format,
    zoom: zoomStart,
    protectedBounds,
    productVisibilityRequired,
    margin: productVisibilityRequired ? 0.06 : 0.02,
  });
  let finalViewport = viewportAroundFocus({
    focus,
    format,
    zoom: zoomEnd,
    protectedBounds,
    productVisibilityRequired,
    margin: productVisibilityRequired ? 0.04 : 0.01,
  });

  const validated = validateAndCorrectCameraPlan({
    initialViewport,
    finalViewport,
    cropFocusX: cropFocus.x,
    cropFocusY: cropFocus.y,
    zoomStart,
    zoomEnd,
    protectedBounds,
    productVisibilityRequired,
    safeMax,
  });

  initialViewport = validated.initialViewport;
  finalViewport = validated.finalViewport;
  zoomStart = validated.zoomStart;
  zoomEnd = validated.zoomEnd;
  if (validated.corrected) {
    validationStatus = framing ? "corrected" : "fallback";
    safetyAdjusted = true;
    reason = `${reason} ${validated.reason}`;
  }
  if (validated.fallback) {
    validationStatus = "fallback";
    fallbackUsed = true;
    reason = validated.reason;
  }

  const intensity = input.motionParams?.intensity ?? 0.6;
  const renderParams: MotionRenderParams & { cropFocusX: number; cropFocusY: number } = {
    maxZoom: Number(zoomEnd.toFixed(3)),
    focusX: Number(focus.x.toFixed(3)),
    focusY: Number(focus.y.toFixed(3)),
    intensity,
    directedType: (input.directedType as DirectedMotionType)
      ?? (input.motionParams?.directedType as DirectedMotionType)
      ?? "SUBTLE_PUSH_IN",
    framingBasis: framing?.analysisBasis ?? (input.framingInspection ? "estimated-center" : "none"),
    safetyAdjusted,
    fallbackUsed,
    cropFocusX: Number(validated.cropFocusX.toFixed(3)),
    cropFocusY: Number(validated.cropFocusY.toFixed(3)),
  };

  return {
    projectId: input.projectId,
    sceneId: input.clip.sceneId,
    assetId: input.clip.assetId,
    mode,
    targetFormat: format,
    sourceWidth: input.framingInspection?.sourceWidth ?? 0,
    sourceHeight: input.framingInspection?.sourceHeight ?? 0,
    sourceOrientation: input.framingInspection?.orientation ?? "unknown",
    protectedProductBounds: protectedBounds,
    initialViewport,
    finalViewport,
    focusPoint: focus,
    cropFocusX: renderParams.cropFocusX,
    cropFocusY: renderParams.cropFocusY,
    zoomStart: Number(zoomStart.toFixed(3)),
    zoomEnd: renderParams.maxZoom,
    panAllowed: String(renderParams.directedType).startsWith("PAN_") || String(renderParams.directedType) === "DIAGONAL_DRIFT",
    productVisibilityRequired,
    minimumMargin: productVisibilityRequired ? 0.04 : 0.01,
    occupancyTarget: Number(occupancyTarget.toFixed(3)),
    reservedTextZones: reserved,
    validationStatus,
    fallbackUsed,
    safetyAdjusted,
    reason: reason.trim(),
    renderParams,
  };
}

export function applySmartCameraToTimeline(input: {
  clips: VideoTimelineClip[];
  profileAspectRatio: VideoAspectRatio | PrepAspectRatio;
  projectId?: string;
  framingByAssetId?: Map<string, FramingInspection | null | undefined>;
  roleByAssetId?: Map<string, ProductionRoleDecision | null | undefined>;
  productCategory?: string | null;
}): {
  clips: Array<VideoTimelineClip & { cameraPlan?: SmartCameraPlan; motionParams?: MotionRenderParams & { cropFocusX?: number; cropFocusY?: number } }>;
  plans: SmartCameraPlan[];
} {
  const plans: SmartCameraPlan[] = [];
  let previous: SmartCameraPlan | null = null;
  const clips = input.clips.map((clip, index) => {
    const plan = buildSmartCameraPlan({
      projectId: input.projectId,
      clip,
      aspectRatio: input.profileAspectRatio,
      framingInspection: input.framingByAssetId?.get(clip.assetId) ?? null,
      role: input.roleByAssetId?.get(clip.assetId) ?? null,
      motionParams: clip.motionParams as MotionRenderParams | undefined,
      directedType: clip.motionPlan?.directedType ?? clip.motionParams?.directedType,
      productCategory: input.productCategory,
      isLast: index === input.clips.length - 1,
      previousPlan: previous,
    });
    previous = plan;
    plans.push(plan);
    const motionParams = {
      ...(clip.motionParams ?? plan.renderParams),
      maxZoom: plan.renderParams.maxZoom,
      focusX: plan.renderParams.focusX,
      focusY: plan.renderParams.focusY,
      intensity: plan.renderParams.intensity,
      cropFocusX: plan.cropFocusX,
      cropFocusY: plan.cropFocusY,
      safetyAdjusted: plan.safetyAdjusted || Boolean(clip.motionParams?.safetyAdjusted),
      fallbackUsed: plan.fallbackUsed || Boolean(clip.motionParams?.fallbackUsed),
      directedType: clip.motionParams?.directedType ?? plan.renderParams.directedType,
      framingBasis: clip.motionParams?.framingBasis ?? plan.renderParams.framingBasis,
    };
    return {
      ...clip,
      cameraPlan: plan,
      motionParams,
      motionPlan: clip.motionPlan
        ? {
          ...clip.motionPlan,
          maxZoom: motionParams.maxZoom,
          focusX: motionParams.focusX,
          focusY: motionParams.focusY,
          safetyAdjusted: motionParams.safetyAdjusted,
          fallbackUsed: motionParams.fallbackUsed,
        }
        : clip.motionPlan,
    };
  });
  return { clips, plans };
}

/** Plan compositions for all supported formats (format matrix / diagnostics). */
export function planAllFormats(input: {
  clip: VideoTimelineClip;
  framingInspection?: FramingInspection | null;
  role?: ProductionRoleDecision | null;
  motionParams?: MotionRenderParams | null;
  productCategory?: string | null;
  projectId?: string;
}): Record<PrepAspectRatio, SmartCameraPlan> {
  const formats: PrepAspectRatio[] = ["9:16", "16:9", "1:1", "4:5"];
  const out = {} as Record<PrepAspectRatio, SmartCameraPlan>;
  for (const format of formats) {
    out[format] = buildSmartCameraPlan({
      projectId: input.projectId,
      clip: input.clip,
      aspectRatio: format,
      framingInspection: input.framingInspection,
      role: input.role,
      motionParams: input.motionParams,
      directedType: input.motionParams?.directedType,
      productCategory: input.productCategory,
    });
  }
  return out;
}

export function validateCameraPlanGeometry(plan: Pick<SmartCameraPlan, "cropFocusX" | "cropFocusY" | "zoomStart" | "zoomEnd" | "initialViewport" | "finalViewport" | "protectedProductBounds" | "productVisibilityRequired">): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!Number.isFinite(plan.cropFocusX) || plan.cropFocusX < 0 || plan.cropFocusX > 1) issues.push("cropFocusX out of range");
  if (!Number.isFinite(plan.cropFocusY) || plan.cropFocusY < 0 || plan.cropFocusY > 1) issues.push("cropFocusY out of range");
  if (!(plan.zoomStart >= 1) || !(plan.zoomEnd >= 1)) issues.push("zoom must be >= 1");
  if (plan.zoomEnd > 1.35) issues.push("excessive zoom");
  if (!validViewport(plan.initialViewport)) issues.push("invalid initialViewport");
  if (!validViewport(plan.finalViewport)) issues.push("invalid finalViewport");
  if (plan.productVisibilityRequired) {
    if (!viewportContains(plan.initialViewport, padRect(plan.protectedProductBounds, -0.02))) {
      issues.push("initial viewport may clip protected product");
    }
  }
  return { ok: issues.length === 0, issues };
}

function computeFocusPoint(input: {
  mode: SmartCameraMode;
  productCenter: { x: number; y: number };
  protectedBounds: NormalizedRect;
  reserved: ReservedTextZones;
}): CameraFocusPoint {
  const b = input.protectedBounds;
  let x = input.productCenter.x;
  let y = input.productCenter.y;

  if (input.mode === "TOP_DETAIL") {
    x = b.x + b.width * 0.5;
    y = b.y + b.height * 0.28;
  } else if (input.mode === "SIDE_DETAIL" || input.mode === "LEFT_FOCUS") {
    x = b.x + b.width * 0.28;
    y = b.y + b.height * 0.5;
  } else if (input.mode === "RIGHT_FOCUS") {
    x = b.x + b.width * 0.72;
    y = b.y + b.height * 0.5;
  } else if (input.mode === "DETAIL_CLOSE_UP" || input.mode === "FEATURE_FOCUS") {
    x = b.x + b.width * 0.5;
    y = b.y + b.height * 0.45;
  }

  // Keep primary product content out from under top title band when possible.
  if (input.reserved.top > 0.12 && y < 0.35) {
    y = Math.min(0.55, y + 0.08);
  }
  if (input.reserved.bottom > 0.14 && y > 0.7) {
    y = Math.max(0.45, y - 0.06);
  }

  return { x: clamp01(x), y: clamp01(y) };
}

function computeCoverCropFocus(input: {
  focus: CameraFocusPoint;
  reserved: ReservedTextZones;
  mode: SmartCameraMode;
  preferSafe: boolean;
}): { x: number; y: number } {
  // Subject-aware cover crop: slide toward product focus instead of fixed center.
  let x = input.focus.x;
  let y = input.focus.y;

  // Bias composition so reserved typography bands stay usable.
  if (input.reserved.top >= 0.14) y = Math.min(1, y + 0.04);
  if (input.reserved.bottom >= 0.16) y = Math.max(0, y - 0.03);

  if (input.mode === "WIDE_CONTEXT" || input.preferSafe) {
    // Soften extreme slides for safe/full compositions.
    x = 0.5 + (x - 0.5) * 0.85;
    y = 0.5 + (y - 0.5) * 0.85;
  }

  return { x: clamp01(x), y: clamp01(y) };
}

function viewportAroundFocus(input: {
  focus: CameraFocusPoint;
  format: PrepAspectRatio;
  zoom: number;
  protectedBounds: NormalizedRect;
  productVisibilityRequired: boolean;
  margin: number;
}): CameraViewport {
  const ratio = input.format === "9:16" ? 9 / 16
    : input.format === "16:9" ? 16 / 9
      : input.format === "4:5" ? 4 / 5
        : 1;
  const zoom = Math.max(1, input.zoom);
  let width = Math.min(1, 1 / zoom);
  let height = Math.min(1, width / ratio);
  if (height > 1) {
    height = 1;
    width = Math.min(1, height * ratio);
  }

  if (input.productVisibilityRequired) {
    const needW = input.protectedBounds.width + input.margin * 2;
    const needH = input.protectedBounds.height + input.margin * 2;
    width = Math.max(width, Math.min(1, needW));
    height = Math.max(height, Math.min(1, needH));
    // Maintain format aspect as closely as possible after expansion.
    if (width / height > ratio) height = Math.min(1, width / ratio);
    else width = Math.min(1, height * ratio);
  }

  let x = input.focus.x - width / 2;
  let y = input.focus.y - height / 2;
  x = clamp(x, 0, Math.max(0, 1 - width));
  y = clamp(y, 0, Math.max(0, 1 - height));

  if (input.productVisibilityRequired) {
    const padded = padRect(input.protectedBounds, input.margin * 0.5);
    if (padded.x < x) x = clamp(padded.x, 0, Math.max(0, 1 - width));
    if (padded.y < y) y = clamp(padded.y, 0, Math.max(0, 1 - height));
    if (padded.x + padded.width > x + width) x = clamp(padded.x + padded.width - width, 0, Math.max(0, 1 - width));
    if (padded.y + padded.height > y + height) y = clamp(padded.y + padded.height - height, 0, Math.max(0, 1 - height));
  }

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    width: Number(width.toFixed(4)),
    height: Number(height.toFixed(4)),
  };
}

function validateAndCorrectCameraPlan(input: {
  initialViewport: CameraViewport;
  finalViewport: CameraViewport;
  cropFocusX: number;
  cropFocusY: number;
  zoomStart: number;
  zoomEnd: number;
  protectedBounds: NormalizedRect;
  productVisibilityRequired: boolean;
  safeMax: number;
}): {
  initialViewport: CameraViewport;
  finalViewport: CameraViewport;
  cropFocusX: number;
  cropFocusY: number;
  zoomStart: number;
  zoomEnd: number;
  corrected: boolean;
  fallback: boolean;
  reason: string;
} {
  let { initialViewport, finalViewport, cropFocusX, cropFocusY, zoomStart, zoomEnd } = input;
  let corrected = false;
  let fallback = false;
  const notes: string[] = [];

  if (!Number.isFinite(cropFocusX) || cropFocusX < 0 || cropFocusX > 1) {
    cropFocusX = 0.5;
    corrected = true;
    notes.push("Corrected cropFocusX.");
  }
  if (!Number.isFinite(cropFocusY) || cropFocusY < 0 || cropFocusY > 1) {
    cropFocusY = 0.5;
    corrected = true;
    notes.push("Corrected cropFocusY.");
  }
  if (!(zoomStart >= 1) || !Number.isFinite(zoomStart)) {
    zoomStart = 1;
    corrected = true;
    notes.push("Corrected zoomStart.");
  }
  if (!(zoomEnd >= 1) || !Number.isFinite(zoomEnd) || zoomEnd > Math.max(1.35, input.safeMax + 0.05)) {
    zoomEnd = Math.min(Math.max(1, input.safeMax), 1.2);
    corrected = true;
    notes.push("Clamped zoomEnd.");
  }
  if (zoomEnd < zoomStart) {
    zoomEnd = zoomStart;
    corrected = true;
  }

  if (!validViewport(initialViewport) || !validViewport(finalViewport)) {
    fallback = true;
    corrected = true;
    initialViewport = { x: 0, y: 0, width: 1, height: 1 };
    finalViewport = { x: 0, y: 0, width: 1, height: 1 };
    cropFocusX = 0.5;
    cropFocusY = 0.5;
    zoomStart = 1;
    zoomEnd = 1;
    notes.push("Invalid viewport — safe full-frame fallback.");
  } else if (input.productVisibilityRequired) {
    const core = padRect(input.protectedBounds, -0.01);
    if (!viewportContains(finalViewport, core) && zoomEnd > 1.01) {
      zoomEnd = Math.max(1, zoomEnd * 0.92);
      corrected = true;
      notes.push("Reduced zoom to protect product silhouette.");
    }
  }

  return {
    initialViewport,
    finalViewport,
    cropFocusX,
    cropFocusY,
    zoomStart,
    zoomEnd,
    corrected,
    fallback,
    reason: notes.join(" ") || "ok",
  };
}

function validViewport(v: CameraViewport): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.width) && Number.isFinite(v.height)
    && v.width > 0.05 && v.height > 0.05
    && v.x >= -0.001 && v.y >= -0.001
    && v.x + v.width <= 1.001
    && v.y + v.height <= 1.001;
}

function viewportContains(outer: CameraViewport, inner: NormalizedRect): boolean {
  return inner.x >= outer.x - 0.01
    && inner.y >= outer.y - 0.01
    && inner.x + inner.width <= outer.x + outer.width + 0.01
    && inner.y + inner.height <= outer.y + outer.height + 0.01;
}

function padRect(r: NormalizedRect, pad: number): NormalizedRect {
  const x = clamp01(r.x - pad);
  const y = clamp01(r.y - pad);
  const x2 = clamp01(r.x + r.width + pad);
  const y2 = clamp01(r.y + r.height + pad);
  return { x, y, width: Math.max(0.02, x2 - x), height: Math.max(0.02, y2 - y) };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
