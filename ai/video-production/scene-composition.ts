/**
 * STEP 10 — Intelligent visual composition & scene layout integration.
 * Consumes STEP 6 product bounds, STEP 8 motion, STEP 9 camera, and feeds
 * frame-space product protection into existing Typography STEP 1–4.
 * Does not create a second typography or video renderer.
 */
import type { PlacementRegion, TextRole, TypographyDecision, TypographyItem } from "../typography/types.js";
import { areasCollide } from "../typography/collision.js";
import { REGION_COORDS, regionOverlapsProduct } from "../typography/placement.js";
import type { SmartCameraPlan } from "./smart-camera.js";
import type { VideoTimelineClip } from "./types.js";

export type CompositionImportance =
  | "PRIMARY"
  | "SECONDARY"
  | "SUPPORTING"
  | "CRITICAL_ACTION"
  | "MINOR";

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompositionElementSummary {
  id: string;
  role: string;
  importance: CompositionImportance;
  region: string;
  normalizedX: number;
  normalizedY: number;
  readabilityPassed?: boolean;
  overlapsProduct: boolean;
}

export interface SceneCompositionPlan {
  projectId: string;
  sceneId: string;
  assetId: string;
  format: string;
  purpose: string;
  product: {
    assetId: string;
    sourceProtected?: FrameRect;
    frameProtected: FrameRect;
    frameCenter: { x: number; y: number };
    bias: "left" | "right" | "top" | "bottom" | "center";
    cameraMode?: string;
    motionDirected?: string;
    zoomEnd?: number;
    cropFocusX?: number;
    cropFocusY?: number;
  };
  preferredTextSides: Array<"left" | "right" | "top" | "bottom">;
  elements: CompositionElementSummary[];
  safeZones: { top: number; bottom: number; left: number; right: number };
  compositionValid: boolean;
  issues: string[];
  warnings: string[];
  fallbackUsed: boolean;
  version: "step10-composition-v1";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Map source-space product protection through STEP 9 cover-crop focus into frame space. */
export function mapProductProtectionToFrame(input: {
  protectedBounds?: FrameRect | null;
  productCenter?: { x: number; y: number } | null;
  cropFocusX?: number;
  cropFocusY?: number;
  zoomEnd?: number;
  /** Expand protection slightly along motion zoom (product grows toward focus). */
  motionAware?: boolean;
}): { frameProtected: FrameRect; frameCenter: { x: number; y: number }; bias: SceneCompositionPlan["product"]["bias"]; fallbackUsed: boolean } {
  const cropX = clamp01(input.cropFocusX ?? 0.5);
  const cropY = clamp01(input.cropFocusY ?? 0.5);
  const source = input.protectedBounds ?? { x: 0.22, y: 0.22, width: 0.56, height: 0.56 };
  const center = input.productCenter ?? {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  };

  // After cover crop, sliding cropFocus toward product centers it; residual offset remains in frame.
  let frameCx = clamp01(0.5 + (center.x - cropX));
  let frameCy = clamp01(0.5 + (center.y - cropY));

  const zoom = Math.max(1, input.zoomEnd ?? 1);
  let width = clamp(source.width * Math.min(1.15, 0.85 + zoom * 0.15), 0.28, 0.82);
  let height = clamp(source.height * Math.min(1.15, 0.85 + zoom * 0.15), 0.28, 0.82);

  if (input.motionAware && zoom > 1.02) {
    // Product enlarges toward focus — grow protection box modestly.
    width = Math.min(0.88, width * (1 + (zoom - 1) * 0.45));
    height = Math.min(0.88, height * (1 + (zoom - 1) * 0.45));
  }

  let x = clamp(frameCx - width / 2, 0, 1 - width);
  let y = clamp(frameCy - height / 2, 0, 1 - height);

  // Keep protection covering estimated product center.
  if (frameCx < x) x = clamp(frameCx - width * 0.2, 0, 1 - width);
  if (frameCx > x + width) x = clamp(frameCx - width * 0.8, 0, 1 - width);
  if (frameCy < y) y = clamp(frameCy - height * 0.2, 0, 1 - height);
  if (frameCy > y + height) y = clamp(frameCy - height * 0.8, 0, 1 - height);

  const bias = classifyBias(frameCx, frameCy);
  const fallbackUsed = !input.protectedBounds;

  return {
    frameProtected: {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      width: Number(width.toFixed(4)),
      height: Number(height.toFixed(4)),
    },
    frameCenter: { x: Number(frameCx.toFixed(4)), y: Number(frameCy.toFixed(4)) },
    bias,
    fallbackUsed,
  };
}

export function classifyBias(cx: number, cy: number): SceneCompositionPlan["product"]["bias"] {
  if (cx < 0.4) return "left";
  if (cx > 0.6) return "right";
  if (cy < 0.38) return "top";
  if (cy > 0.62) return "bottom";
  return "center";
}

export function preferredTextSidesForBias(
  bias: SceneCompositionPlan["product"]["bias"],
  purpose: string,
): Array<"left" | "right" | "top" | "bottom"> {
  const primary = purpose.toUpperCase().split(/[|/]+/)[0]?.trim() || purpose.toUpperCase();
  if (/CTA|PRICE|OFFER/.test(primary)) {
    if (bias === "left") return ["bottom", "right", "top"];
    if (bias === "right") return ["bottom", "left", "top"];
    return ["bottom", "top"];
  }
  if (/HOOK|REVEAL|HERO|INTRO/.test(primary)) {
    if (bias === "left") return ["top", "right"];
    if (bias === "right") return ["top", "left"];
    return ["top", "bottom"];
  }
  if (bias === "left") return ["right", "top", "bottom"];
  if (bias === "right") return ["left", "top", "bottom"];
  if (bias === "top") return ["bottom", "left", "right"];
  if (bias === "bottom") return ["top", "left", "right"];
  return ["top", "bottom"];
}

export function importanceForRole(role: string, purpose: string): CompositionImportance {
  const r = role.toLowerCase();
  const p = purpose.toUpperCase();
  if (r === "cta") return "CRITICAL_ACTION";
  if (r === "price" || r === "discount") return /PRICE|OFFER|CTA|HOOK/.test(p) ? "PRIMARY" : "PRIMARY";
  if (r === "previousprice") return "SUPPORTING";
  if (r === "hook" || r === "headline" || r === "title" || r === "productname") {
    return /HOOK|REVEAL|HERO|FEATURE/.test(p) ? "PRIMARY" : "SECONDARY";
  }
  if (r === "benefit" || r === "productfeature") return "SECONDARY";
  if (r === "website" || r === "phone" || r === "brand") return "MINOR";
  return "SUPPORTING";
}

/** Build composition plan for one timeline clip using camera + typography decision. */
export function buildSceneCompositionPlan(input: {
  projectId: string;
  clip: VideoTimelineClip;
  format: string;
  cameraPlan?: SmartCameraPlan | VideoTimelineClip["cameraPlan"] | null;
  typographyItems?: TypographyItem[];
  sourceOccupied?: FrameRect | null;
  safeZones?: { top: number; bottom: number; left: number; right: number };
}): SceneCompositionPlan {
  const cam = (input.cameraPlan ?? input.clip.cameraPlan) as SmartCameraPlan | null | undefined;
  const protectedBounds = cam?.protectedProductBounds
    ?? input.sourceOccupied
    ?? null;
  const mapped = mapProductProtectionToFrame({
    protectedBounds,
    productCenter: cam?.focusPoint
      ?? (protectedBounds
        ? { x: protectedBounds.x + protectedBounds.width / 2, y: protectedBounds.y + protectedBounds.height / 2 }
        : null),
    cropFocusX: cam?.cropFocusX ?? input.clip.motionParams?.cropFocusX,
    cropFocusY: cam?.cropFocusY ?? input.clip.motionParams?.cropFocusY,
    zoomEnd: cam?.zoomEnd ?? input.clip.motionParams?.maxZoom,
    motionAware: true,
  });

  const sides = preferredTextSidesForBias(mapped.bias, input.clip.purpose);
  const safeZones = input.safeZones ?? { top: 0.1, bottom: 0.14, left: 0.06, right: 0.06 };
  const elements: CompositionElementSummary[] = (input.typographyItems ?? []).map((item) => ({
    id: item.id,
    role: item.role,
    importance: importanceForRole(item.role, input.clip.purpose),
    region: item.layout.region,
    normalizedX: item.layout.normalizedX,
    normalizedY: item.layout.normalizedY,
    readabilityPassed: item.visual?.readabilityPassed,
    overlapsProduct: regionOverlapsProduct(
      item.layout.region,
      mapped.bias === "center",
      mapped.frameProtected,
    ) || rectOverlapsPoint(mapped.frameProtected, item.layout.normalizedX, item.layout.normalizedY)
      || (item.boundingArea
        ? rectOverlapRatio(mapped.frameProtected, item.boundingArea) > 0.28
        : false),
  }));

  const issues: string[] = [];
  const warnings: string[] = [];

  if (!input.projectId) issues.push("missing projectId");
  if (!input.clip.sceneId) issues.push("missing sceneId");
  if (!input.clip.assetId) issues.push("missing assetId");

  for (const el of elements) {
    if (el.importance === "PRIMARY" || el.importance === "CRITICAL_ACTION") {
      if (el.overlapsProduct) {
        issues.push(`${el.role} overlaps protected product region`);
      }
      if (el.readabilityPassed === false) {
        issues.push(`${el.role} failed readability`);
      }
    } else if (el.overlapsProduct) {
      warnings.push(`${el.role} near product protection zone`);
    }
  }

  // Element-to-element collision among critical layers
  const critical = (input.typographyItems ?? []).filter((item) => {
    const imp = importanceForRole(item.role, input.clip.purpose);
    return imp === "PRIMARY" || imp === "CRITICAL_ACTION";
  });
  for (let i = 0; i < critical.length; i += 1) {
    for (let j = i + 1; j < critical.length; j += 1) {
      const a = critical[i]!;
      const b = critical[j]!;
      if (areasCollide(a.boundingArea, b.boundingArea, 0.4)) {
        issues.push(`${a.role} collides with ${b.role}`);
      }
    }
  }

  // Price currency connection already handled in typography; flag empty price content.
  const priceItems = elements.filter((e) => e.role === "price");
  for (const p of priceItems) {
    const item = input.typographyItems?.find((t) => t.id === p.id);
    if (item && /RWF|\d/.test(item.text) === false) {
      warnings.push("price text missing currency/amount markers");
    }
  }

  return {
    projectId: input.projectId,
    sceneId: input.clip.sceneId,
    assetId: input.clip.assetId,
    format: input.format,
    purpose: input.clip.purpose,
    product: {
      assetId: input.clip.assetId,
      sourceProtected: protectedBounds ?? undefined,
      frameProtected: mapped.frameProtected,
      frameCenter: mapped.frameCenter,
      bias: mapped.bias,
      cameraMode: cam?.mode,
      motionDirected: input.clip.motionPlan?.directedType ?? input.clip.motionParams?.directedType,
      zoomEnd: cam?.zoomEnd ?? input.clip.motionParams?.maxZoom,
      cropFocusX: cam?.cropFocusX ?? input.clip.motionParams?.cropFocusX,
      cropFocusY: cam?.cropFocusY ?? input.clip.motionParams?.cropFocusY,
    },
    preferredTextSides: sides,
    elements,
    safeZones,
    compositionValid: issues.length === 0,
    issues,
    warnings,
    fallbackUsed: mapped.fallbackUsed,
    version: "step10-composition-v1",
  };
}

/** Apply typography decision + camera into per-clip composition plans; strip unsafe critical overlaps when correctable via warning only. */
export function applyCompositionToTimeline(input: {
  projectId: string;
  clips: VideoTimelineClip[];
  format: string;
  typography?: TypographyDecision | null;
  sourceOccupiedByAssetId?: Map<string, FrameRect | null | undefined>;
}): {
  clips: Array<VideoTimelineClip & { compositionPlan?: SceneCompositionPlan }>;
  plans: SceneCompositionPlan[];
  allValid: boolean;
} {
  const plans: SceneCompositionPlan[] = [];
  const clips = input.clips.map((clip) => {
    const sceneTy = input.typography?.scenes.find((s) => s.sceneId === clip.sceneId);
    const plan = buildSceneCompositionPlan({
      projectId: input.projectId,
      clip,
      format: input.format,
      cameraPlan: clip.cameraPlan,
      typographyItems: sceneTy?.items,
      sourceOccupied: input.sourceOccupiedByAssetId?.get(clip.assetId) ?? null,
    });
    plans.push(plan);
    return { ...clip, compositionPlan: plan };
  });
  return {
    clips,
    plans,
    allValid: plans.every((p) => p.compositionValid),
  };
}

/** Frame-space occupied region for typography image hints (STEP 1–4 reuse). */
export function compositionHintForTypography(input: {
  cameraPlan?: SmartCameraPlan | VideoTimelineClip["cameraPlan"] | null;
  sourceOccupied?: FrameRect | null;
  motionMaxZoom?: number;
  cropFocusX?: number;
  cropFocusY?: number;
}): {
  productOccupiedRegion: FrameRect;
  productLikelyCentered: boolean;
  compositionBias: SceneCompositionPlan["product"]["bias"];
  preferredTextSides: Array<"left" | "right" | "top" | "bottom">;
} {
  const cam = input.cameraPlan as SmartCameraPlan | null | undefined;
  const mapped = mapProductProtectionToFrame({
    protectedBounds: cam?.protectedProductBounds ?? input.sourceOccupied,
    productCenter: cam?.focusPoint,
    cropFocusX: cam?.cropFocusX ?? input.cropFocusX,
    cropFocusY: cam?.cropFocusY ?? input.cropFocusY,
    zoomEnd: cam?.zoomEnd ?? input.motionMaxZoom,
    motionAware: true,
  });
  return {
    productOccupiedRegion: mapped.frameProtected,
    productLikelyCentered: mapped.bias === "center",
    compositionBias: mapped.bias,
    preferredTextSides: preferredTextSidesForBias(mapped.bias, "FEATURE"),
  };
}

export function getCompositionDiagnostics(input?: {
  sceneCount?: number;
  invalidCount?: number;
}) {
  return {
    compositionEngineAvailable: true,
    version: "step10-composition-v1",
    typographyIntegration: "reuses-typography-step1-4",
    productProtection: true,
    formatComposition: ["9:16", "16:9", "1:1", "4:5"],
    collisionHandling: true,
    contrastReadiness: "via-typography-step4",
    sceneCompositionStatus: typeof input?.sceneCount === "number"
      ? `${input.sceneCount} scenes, invalid=${input.invalidCount ?? 0}`
      : "idle",
    notes: [
      "STEP 10 maps STEP 9 camera + STEP 6 bounds into frame-space product protection for typography placement.",
      "Ollama is optional assist only; geometry and collisions remain deterministic.",
    ],
  };
}

function rectOverlapsPoint(r: FrameRect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

function rectOverlapRatio(a: FrameRect, b: FrameRect): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  const smaller = Math.min(a.width * a.height, b.width * b.height) || 1;
  return inter / smaller;
}

/** Export region candidates helper for tests / placement integration. */
export function candidateRegionsForSides(
  sides: Array<"left" | "right" | "top" | "bottom">,
  role: TextRole,
): PlacementRegion[] {
  const out: PlacementRegion[] = [];
  for (const side of sides) {
    if (side === "top") out.push("top-center", "upper-center", "top-left", "top-right");
    if (side === "bottom") out.push("bottom-center", "lower-center", "bottom-left", "bottom-right");
    if (side === "left") out.push("center-left", "top-left", "bottom-left");
    if (side === "right") out.push("center-right", "top-right", "bottom-right");
  }
  if (role === "cta" || role === "price") {
    return [...new Set(["bottom-center", "lower-center", ...out])] as PlacementRegion[];
  }
  return [...new Set(out)] as PlacementRegion[];
}

export function regionAwayFromProduct(
  product: FrameRect,
  candidates: PlacementRegion[],
): PlacementRegion | null {
  for (const region of candidates) {
    const point = REGION_COORDS[region];
    if (!point) continue;
    if (!rectOverlapsPoint(product, point.x, point.y)) return region;
  }
  return null;
}
