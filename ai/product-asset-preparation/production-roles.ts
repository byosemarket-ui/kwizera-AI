/**
 * STEP 6 — production usage roles for later AI PRODUCT MOTION stages.
 * Does not render video; preparation decisions only.
 */
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import type { ProductImage } from "../creative-workspace/creative-workspace-manager.js";

export type ProductionImageRole =
  | "HERO_PRODUCT"
  | "MAIN_REVEAL"
  | "DETAIL_CLOSE_UP"
  | "FEATURE_VIEW"
  | "ALTERNATE_ANGLE"
  | "WIDE_PRODUCT_VIEW"
  | "SUPPORTING_VIEW"
  | "LOW_CONFIDENCE"
  | "UNSUITABLE";

export interface ProductionRoleDecision {
  role: ProductionImageRole;
  confidence: number;
  safeToUse: boolean;
  recommendedUsage: string;
  reason: string;
  analysisBasis: "image-intelligence" | "dimensions" | "heuristic" | "unknown";
}

const DETAIL_ROLES = new Set(["detail", "close-up", "macro", "packaging"]);
const ANGLE_ROLES = new Set(["left", "right", "side", "back", "rear", "top", "bottom", "three-quarter"]);
const WIDE_HINTS = /wide|lifestyle|environment|context|full.?body|full.?view/i;

export function classifyProductionRole(input: {
  image: ProductImage;
  profile?: ImageIntelligenceProfile | null;
  suitabilityScore: number;
  suitableForProduction: boolean;
}): ProductionRoleDecision {
  if (!input.suitableForProduction || input.suitabilityScore < 35) {
    return {
      role: "UNSUITABLE",
      confidence: 70,
      safeToUse: false,
      recommendedUsage: "Do not use for AI PRODUCT MOTION until a better source image is provided.",
      reason: "Quality or validity below production threshold.",
      analysisBasis: input.profile ? "image-intelligence" : "heuristic",
    };
  }

  const view = (input.profile?.viewRole ?? "").toLowerCase();
  const visibility = input.profile?.visibility;
  const qualityScore = input.profile?.quality.score ?? input.suitabilityScore;
  const cutoff = Boolean(visibility?.cutoff);
  const framing = visibility?.framing ?? "";
  const smallInFrame = /small in frame/i.test(framing);
  const confidenceCap = Math.min(92, Math.round((input.profile?.boundaries.confidence ?? 55) + qualityScore / 5));

  if (qualityScore < 50 || visibility?.status === "poor" || visibility?.status === "needs-review") {
    return {
      role: "LOW_CONFIDENCE",
      confidence: Math.min(65, confidenceCap),
      safeToUse: qualityScore >= 45 && !cutoff,
      recommendedUsage: "Use only as supporting B-roll if no better asset exists; prefer re-shoot.",
      reason: `Low confidence from quality=${qualityScore} visibility=${visibility?.status ?? "unknown"}.`,
      analysisBasis: "image-intelligence",
    };
  }

  if (DETAIL_ROLES.has(view) || /detail|close|macro|texture|feature/i.test(view)) {
    return {
      role: "DETAIL_CLOSE_UP",
      confidence: confidenceCap,
      safeToUse: !cutoff,
      recommendedUsage: "Use for feature/detail beats; avoid as sole hero reveal.",
      reason: `View role indicates detail/close-up (${view || "inferred"}).`,
      analysisBasis: input.profile ? "image-intelligence" : "heuristic",
    };
  }

  if (WIDE_HINTS.test(view) || WIDE_HINTS.test(input.profile?.composition ?? "") || WIDE_HINTS.test(input.image.fileName)) {
    return {
      role: "WIDE_PRODUCT_VIEW",
      confidence: Math.min(80, confidenceCap),
      safeToUse: true,
      recommendedUsage: "Use for establishing/context shots; protect product scale in framing.",
      reason: "Composition or filename suggests a wide/context product view.",
      analysisBasis: input.profile ? "image-intelligence" : "heuristic",
    };
  }

  if (ANGLE_ROLES.has(view)) {
    return {
      role: "ALTERNATE_ANGLE",
      confidence: confidenceCap,
      safeToUse: !cutoff,
      recommendedUsage: "Use to show alternate product angles after the main reveal.",
      reason: `Alternate angle viewRole=${view}.`,
      analysisBasis: "image-intelligence",
    };
  }

  if (/feature|benefit|highlight/i.test(view) || /feature/i.test(input.image.fileName)) {
    return {
      role: "FEATURE_VIEW",
      confidence: Math.min(78, confidenceCap),
      safeToUse: true,
      recommendedUsage: "Use when highlighting a specific product feature.",
      reason: "Feature-oriented naming or view role.",
      analysisBasis: "heuristic",
    };
  }

  const isPrimary = input.image.assetRole === "primary" || view === "front" || view === "hero";
  const strongHero = isPrimary && qualityScore >= 70 && !cutoff && !smallInFrame;

  if (strongHero) {
    return {
      role: "HERO_PRODUCT",
      confidence: confidenceCap,
      safeToUse: true,
      recommendedUsage: "Preferred primary product image for hero/reveal beats.",
      reason: `Strong front/primary view with quality=${qualityScore}.`,
      analysisBasis: input.profile ? "image-intelligence" : "dimensions",
    };
  }

  if (isPrimary || view === "front" || !view || view === "unknown") {
    return {
      role: "MAIN_REVEAL",
      confidence: Math.min(75, confidenceCap),
      safeToUse: !cutoff,
      recommendedUsage: "Suitable for main product reveal when a stronger hero is unavailable.",
      reason: isPrimary ? "Primary/front product view." : "Default main reveal when specialized role is unclear.",
      analysisBasis: input.profile ? "image-intelligence" : "heuristic",
    };
  }

  return {
    role: "SUPPORTING_VIEW",
    confidence: Math.min(70, confidenceCap),
    safeToUse: true,
    recommendedUsage: "Supporting product continuity between hero and detail shots.",
    reason: `Supporting classification for viewRole=${view || "unknown"}.`,
    analysisBasis: "heuristic",
  };
}

/** Prefer distinct roles across a set — avoid assigning every image HERO_PRODUCT. */
export function resolveUniqueHeroRoles(decisions: ProductionRoleDecision[]): ProductionRoleDecision[] {
  let heroAssigned = false;
  return decisions.map((decision) => {
    if (decision.role !== "HERO_PRODUCT") return decision;
    if (!heroAssigned) {
      heroAssigned = true;
      return decision;
    }
    return {
      ...decision,
      role: "MAIN_REVEAL",
      reason: `${decision.reason} Demoted from HERO_PRODUCT — one hero already selected.`,
      recommendedUsage: "Alternate main reveal; another asset is the primary hero.",
    };
  });
}
