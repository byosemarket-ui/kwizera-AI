/**
 * STEP 6 — product image quality / suitability inspection.
 * Reuses Image Intelligence when available; never invents false precision.
 */
import type { ProductImage } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";

export type SuitabilityVerdict =
  | "suitable"
  | "usable_with_caution"
  | "avoid"
  | "invalid"
  | "unknown";

export type AnalysisCertainty = "measured" | "estimated" | "unknown" | "unavailable";

export interface ImageQualityInspection {
  projectId: string;
  assetId: string;
  sourceImageId: string;
  fileName: string;
  valid: boolean;
  decodable: boolean | "unknown";
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  orientation: "landscape" | "portrait" | "square" | "unknown";
  resolutionTier: "low" | "standard" | "high" | "unknown";
  productVisibility: "good" | "acceptable" | "needs-review" | "poor" | "unknown";
  productCentered: boolean | "unknown";
  nearEdge: boolean | "unknown";
  backgroundComplexity: "low" | "medium" | "high" | "unknown";
  sharpness: "acceptable" | "low" | "unknown";
  emptySpaceUseful: boolean | "unknown";
  suitability: SuitabilityVerdict;
  suitabilityScore: number;
  suitableForCloseUp: boolean | "unknown";
  suitableForMainReveal: boolean | "unknown";
  suitableForDetail: boolean | "unknown";
  suitableForWide: boolean | "unknown";
  avoidForProduction: boolean;
  confidence: number;
  certainty: AnalysisCertainty;
  warnings: string[];
  reasons: string[];
}

export function inspectImageQuality(input: {
  projectId: string;
  image: ProductImage;
  profile?: ImageIntelligenceProfile | null;
  fileMissing?: boolean;
  decodeFailed?: boolean;
}): ImageQualityInspection {
  const image = input.image;
  const profile = input.profile ?? null;
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (input.fileMissing) {
    return invalidInspection(input.projectId, image, "Original asset file missing.", "unavailable");
  }
  if (input.decodeFailed) {
    return invalidInspection(input.projectId, image, "Image could not be decoded.", "measured");
  }
  if (!image.sizeBytes || image.sizeBytes <= 0) {
    return invalidInspection(input.projectId, image, "Zero-byte or empty image.", "measured");
  }

  const width = image.width ?? profile?.visualMetrics?.width ?? null;
  const height = image.height ?? profile?.visualMetrics?.height ?? null;
  const aspectRatio = width && height ? Number((width / height).toFixed(4)) : profile?.visualMetrics?.aspectRatio ?? null;
  const orientation = !width || !height
    ? "unknown"
    : Math.abs(width - height) / Math.max(width, height) < 0.05
      ? "square"
      : width > height
        ? "landscape"
        : "portrait";

  const resolutionTier = profile?.resolution.tier
    ?? (width && height
      ? (Math.min(width, height) < 400 ? "low" : Math.min(width, height) >= 1200 ? "high" : "standard")
      : "unknown");

  const visibility = profile?.visibility?.status ?? "unknown";
  const framingNote = profile?.visibility?.framing ?? "";
  const cutoff = Boolean(profile?.visibility?.cutoff);
  const productCentered: boolean | "unknown" = profile
    ? !/edge|left|right|off.?center/i.test(`${framingNote} ${profile.composition}`)
    : "unknown";
  const nearEdge: boolean | "unknown" = profile
    ? cutoff || /edge|cut-?off/i.test(framingNote)
    : "unknown";
  const backgroundComplexity = profile?.background.complexity ?? "unknown";
  const qualityScore = profile?.quality.score;
  const sharpness: ImageQualityInspection["sharpness"] = qualityScore == null
    ? "unknown"
    : qualityScore < 45
      ? "low"
      : "acceptable";

  let suitabilityScore = qualityScore ?? 55;
  if (resolutionTier === "low") suitabilityScore -= 12;
  if (cutoff) suitabilityScore -= 20;
  if (visibility === "poor") suitabilityScore -= 25;
  if (visibility === "needs-review") suitabilityScore -= 10;
  if (profile?.quality.classification === "POOR") suitabilityScore -= 20;
  if (profile?.defects?.length) suitabilityScore -= Math.min(15, profile.defects.length * 4);
  suitabilityScore = Math.max(0, Math.min(100, Math.round(suitabilityScore)));

  let suitability: SuitabilityVerdict = "unknown";
  let certainty: AnalysisCertainty = profile ? "estimated" : "unknown";
  if (profile?.visualMetrics?.width && profile.visualMetrics.height) certainty = "measured";
  if (width && height && !profile) certainty = "estimated";

  if (suitabilityScore < 35 || visibility === "poor" || profile?.quality.classification === "POOR") {
    suitability = "avoid";
    reasons.push("Quality or visibility too low for production.");
  } else if (suitabilityScore < 55 || visibility === "needs-review" || cutoff) {
    suitability = "usable_with_caution";
    reasons.push("Usable with caution — framing or quality concerns.");
  } else if (profile || (width && height)) {
    suitability = "suitable";
    reasons.push("Meets basic production suitability thresholds.");
  } else {
    suitability = "unknown";
    warnings.push("Limited analysis available — suitability marked unknown.");
    reasons.push("Insufficient measured analysis.");
  }

  if (nearEdge === true) warnings.push("Important product parts may be near the edge.");
  if (resolutionTier === "low") warnings.push("Resolution may be too low for close-up motion.");
  if (!profile) warnings.push("Image intelligence profile unavailable — using dimensions/heuristics only.");

  const view = (profile?.viewRole ?? "").toLowerCase();
  const suitableForDetail: boolean | "unknown" = !profile && suitability === "unknown"
    ? "unknown"
    : suitability !== "avoid" && ( /detail|close|macro/.test(view) || suitabilityScore >= 60);
  const suitableForCloseUp: boolean | "unknown" = !profile && suitability === "unknown"
    ? "unknown"
    : suitability !== "avoid" && resolutionTier !== "low" && !cutoff;
  const suitableForMainReveal: boolean | "unknown" = !profile && suitability === "unknown"
    ? "unknown"
    : suitability === "suitable" && !cutoff && (view === "front" || view === "unknown" || image.assetRole === "primary" || !view);
  const suitableForWide: boolean | "unknown" = !profile && suitability === "unknown"
    ? "unknown"
    : suitability !== "avoid";

  const emptySpaceUseful: boolean | "unknown" = profile
    ? /good|acceptable/i.test(visibility) && !/too close|cut-?off/i.test(framingNote)
    : "unknown";

  return {
    projectId: input.projectId,
    assetId: image.id,
    sourceImageId: image.id,
    fileName: image.fileName,
    valid: true,
    decodable: profile?.visualMetrics ? true : width && height ? true : "unknown",
    width,
    height,
    aspectRatio,
    orientation,
    resolutionTier,
    productVisibility: visibility === "good" || visibility === "acceptable" || visibility === "needs-review" || visibility === "poor"
      ? visibility
      : "unknown",
    productCentered,
    nearEdge,
    backgroundComplexity,
    sharpness,
    emptySpaceUseful,
    suitability,
    suitabilityScore,
    suitableForCloseUp,
    suitableForMainReveal,
    suitableForDetail,
    suitableForWide,
    avoidForProduction: suitability === "avoid" || suitability === "invalid",
    confidence: profile ? Math.min(90, Math.round((profile.quality.confidence ?? 50) + 10)) : 40,
    certainty,
    warnings,
    reasons,
  };
}

function invalidInspection(
  projectId: string,
  image: ProductImage,
  reason: string,
  certainty: AnalysisCertainty,
): ImageQualityInspection {
  return {
    projectId,
    assetId: image.id,
    sourceImageId: image.id,
    fileName: image.fileName,
    valid: false,
    decodable: false,
    width: image.width ?? null,
    height: image.height ?? null,
    aspectRatio: null,
    orientation: "unknown",
    resolutionTier: "unknown",
    productVisibility: "unknown",
    productCentered: "unknown",
    nearEdge: "unknown",
    backgroundComplexity: "unknown",
    sharpness: "unknown",
    emptySpaceUseful: "unknown",
    suitability: "invalid",
    suitabilityScore: 0,
    suitableForCloseUp: false,
    suitableForMainReveal: false,
    suitableForDetail: false,
    suitableForWide: false,
    avoidForProduction: true,
    confidence: 95,
    certainty,
    warnings: [reason],
    reasons: [reason],
  };
}
