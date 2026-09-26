/**
 * Phase 16 — smart canvas for still-image scenes.
 * Decides, from STEP 6 framing, whether a cover crop to the target format keeps the protected
 * product area. When it would not, the scene uses SOFT_EXTEND: the full photo is fitted inside the
 * frame over a blurred copy of the same photo. No pixels are generated — the product itself is only
 * scaled, never cropped, recoloured, or edited.
 */
import type { FramingInspection, NormalizedRect, PrepAspectRatio } from "../product-asset-preparation/framing.js";
import type { VideoAspectRatio, VideoMotionId, VideoTimelineClip } from "./types.js";

export const CANVAS_FIT_VERSION = "canvas-fit-v1";

export type CanvasStrategy = "COVER_CROP" | "SOFT_EXTEND";
export type CanvasCropRisk = "SAFE" | "UNSAFE" | "UNCERTAIN";

export interface CanvasFitPlan {
  version: typeof CANVAS_FIT_VERSION;
  sceneId: string;
  assetId: string;
  targetAspect: string;
  strategy: CanvasStrategy;
  cropRisk: CanvasCropRisk;
  /** Where product bounds came from (measured detection vs. centre estimate). */
  basis: "measured-bbox" | "estimated-center" | "unavailable";
  /** Share of the source image a cover crop keeps (0–1). */
  sourceCoverage: number;
  /** Share of the protected product area inside the cover window; null without measured bounds. */
  productKeptRatio: number | null;
  /** Background source for extended canvas areas — always the source photo itself. */
  background: "SOURCE_BLUR" | "NONE";
  generativeExpansion: false;
  /** Product centre in output-frame coordinates after fitting (0–1). */
  productFrameCenter: { x: number; y: number };
  maxZoom: number;
  motionAdjusted: boolean;
  /** A targeted QA repair required the safe layout for this scene. */
  forcedByRepair: boolean;
  reason: string;
}

/** Cover crops keeping less of the source than this are treated as risky when bounds are only estimated. */
export const MIN_SAFE_COVERAGE_ESTIMATED = 0.8;
/** Share of the protected product area that must survive a cover crop. */
export const MIN_PRODUCT_KEPT = 0.98;
const SOFT_EXTEND_MAX_ZOOM = 1.05;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Number(n.toFixed(4));
}

function intersectionArea(a: NormalizedRect, b: NormalizedRect): number {
  const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return w * h;
}

/** Cover-crop window in source-normalized coordinates, slid by the STEP 9 crop focus. */
export function coverWindow(sourceRatio: number, targetRatio: number, focusX = 0.5, focusY = 0.5): NormalizedRect {
  const width = sourceRatio > targetRatio ? targetRatio / sourceRatio : 1;
  const height = sourceRatio > targetRatio ? 1 : sourceRatio / targetRatio;
  return {
    x: (1 - width) * clamp01(focusX),
    y: (1 - height) * clamp01(focusY),
    width,
    height,
  };
}

export function planCanvasFit(input: {
  sceneId: string;
  assetId: string;
  sourceWidth: number;
  sourceHeight: number;
  frameWidth: number;
  frameHeight: number;
  targetAspect: VideoAspectRatio | string;
  framing?: FramingInspection | null;
  cropFocusX?: number;
  cropFocusY?: number;
  /** Targeted repair for this scene — always take the product-preserving layout. */
  forceSafe?: boolean;
  /** Retrieved composition guidance; clamped to 0.7–0.9 so knowledge cannot disable crop protection. */
  minSafeCoverage?: number | null;
}): CanvasFitPlan {
  const minCoverage = typeof input.minSafeCoverage === "number" && Number.isFinite(input.minSafeCoverage)
    ? Math.min(0.9, Math.max(0.7, input.minSafeCoverage))
    : MIN_SAFE_COVERAGE_ESTIMATED;
  const framing = input.framing ?? null;
  const formatPlan = framing?.formats?.[input.targetAspect as PrepAspectRatio];
  const basis = formatPlan?.analysisBasis ?? (framing ? "estimated-center" : "unavailable");
  const product = formatPlan?.protectedProductArea ?? framing?.productBounds ?? null;
  const center = product
    ? { x: product.x + product.width / 2, y: product.y + product.height / 2 }
    : { x: 0.5, y: 0.5 };
  const base = {
    version: CANVAS_FIT_VERSION,
    sceneId: input.sceneId,
    assetId: input.assetId,
    targetAspect: String(input.targetAspect),
    basis,
    generativeExpansion: false,
    motionAdjusted: false,
    forcedByRepair: Boolean(input.forceSafe),
  } as const;

  if (!input.sourceWidth || !input.sourceHeight || !input.frameWidth || !input.frameHeight) {
    return {
      ...base,
      strategy: "COVER_CROP",
      cropRisk: "UNCERTAIN",
      sourceCoverage: 1,
      productKeptRatio: null,
      background: "NONE",
      productFrameCenter: { x: 0.5, y: 0.5 },
      maxZoom: 1.2,
      reason: "Source dimensions unknown; standard subject-aware crop kept.",
    };
  }

  const sourceRatio = input.sourceWidth / input.sourceHeight;
  const targetRatio = input.frameWidth / input.frameHeight;
  const window = coverWindow(sourceRatio, targetRatio, input.cropFocusX, input.cropFocusY);
  const sourceCoverage = window.width * window.height;
  const productKeptRatio = product && basis === "measured-bbox"
    ? intersectionArea(window, product) / Math.max(1e-6, product.width * product.height)
    : null;

  let cropRisk: CanvasCropRisk;
  if (productKeptRatio !== null) cropRisk = productKeptRatio >= MIN_PRODUCT_KEPT ? "SAFE" : "UNSAFE";
  else cropRisk = sourceCoverage >= minCoverage ? "SAFE" : "UNCERTAIN";

  const extend = Boolean(input.forceSafe) || cropRisk === "UNSAFE" || cropRisk === "UNCERTAIN";
  if (!extend) {
    const fx = window.width < 1 ? (center.x - window.x) / window.width : center.x;
    const fy = window.height < 1 ? (center.y - window.y) / window.height : center.y;
    return {
      ...base,
      strategy: "COVER_CROP",
      cropRisk,
      sourceCoverage: round(sourceCoverage),
      productKeptRatio: productKeptRatio === null ? null : round(productKeptRatio),
      background: "NONE",
      productFrameCenter: { x: round(clamp01(fx)), y: round(clamp01(fy)) },
      maxZoom: 1.2,
      reason: productKeptRatio !== null
        ? "Cover crop keeps the full product."
        : "Cover crop keeps most of the photo.",
    };
  }

  // Fitted photo occupies this share of the frame; the rest shows the blurred photo.
  const fitW = sourceRatio >= targetRatio ? 1 : sourceRatio / targetRatio;
  const fitH = sourceRatio >= targetRatio ? targetRatio / sourceRatio : 1;
  return {
    ...base,
    strategy: "SOFT_EXTEND",
    cropRisk,
    sourceCoverage: round(sourceCoverage),
    productKeptRatio: productKeptRatio === null ? null : round(productKeptRatio),
    background: "SOURCE_BLUR",
    productFrameCenter: {
      x: round(clamp01(0.5 + (center.x - 0.5) * fitW)),
      y: round(clamp01(0.5 + (center.y - 0.5) * fitH)),
    },
    maxZoom: SOFT_EXTEND_MAX_ZOOM,
    reason: input.forceSafe
      ? "Quality repair: full photo kept inside the frame."
      : cropRisk === "UNSAFE"
        ? "A crop to this format would cut the product; full photo kept over a blurred extension of itself."
        : "Product position not measured and a crop would remove much of the photo; full photo kept over a blurred extension of itself.",
  };
}

const PAN_MOTIONS = new Set<VideoMotionId>(["pan-left", "pan-right", "pan-up", "pan-down"]);

/** Attach the plan and keep motion inside the fitted photo (no pans across the extension). */
export function applyCanvasFitToClip<T extends VideoTimelineClip>(clip: T, plan: CanvasFitPlan, nearEdge = false): T {
  if (plan.strategy !== "SOFT_EXTEND") return { ...clip, canvasPlan: plan };
  const motion: VideoMotionId = nearEdge ? "hold" : PAN_MOTIONS.has(clip.motion) ? "slow-zoom" : clip.motion;
  const params = clip.motionParams;
  const motionAdjusted = motion !== clip.motion || Boolean(params && params.maxZoom > plan.maxZoom);
  return {
    ...clip,
    motion,
    motionParams: params
      ? {
        ...params,
        maxZoom: Math.min(params.maxZoom, plan.maxZoom),
        focusX: plan.productFrameCenter.x,
        focusY: plan.productFrameCenter.y,
        safetyAdjusted: params.safetyAdjusted || motionAdjusted,
      }
      : params,
    canvasPlan: { ...plan, motionAdjusted },
  };
}

/** Filter chain replacing scale+crop for SOFT_EXTEND scenes (single input, single output). */
export function canvasFitFilter(width: number, height: number): string {
  return [
    "split=2[cfbg][cffg]",
    `[cfbg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=24:2[cfb]`,
    `[cffg]scale=${width}:${height}:force_original_aspect_ratio=decrease[cff]`,
    "[cfb][cff]overlay=(W-w)/2:(H-h)/2,setsar=1",
  ].join(";");
}
