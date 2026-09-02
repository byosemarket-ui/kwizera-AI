/**
 * Map image-intelligence quality classifications to Step 2 media asset statuses.
 */
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import type { MediaAssetStatus } from "./types.js";

export function mapQualityToMediaStatus(
  profile: ImageIntelligenceProfile | null | undefined,
  processingFailed: boolean,
): MediaAssetStatus {
  if (processingFailed) return "FAILED";
  if (!profile) return "PROCESSING";
  if (profile.analysisState === "analyzing" || profile.processingState === "processing") return "PROCESSING";
  if (profile.analysisState === "failed" || profile.processingState === "failed") return "FAILED";

  const classification = profile.quality.classification ?? classifyFromScore(profile.quality.score);
  switch (classification) {
    case "POOR":
      return "LOW_QUALITY";
    case "NEEDS_REVIEW":
      return "NEEDS_REVIEW";
    case "ACCEPTABLE":
    case "GOOD":
      return "READY";
    default:
      return profile.quality.score >= 55 ? "READY" : "NEEDS_REVIEW";
  }
}

function classifyFromScore(score: number): "GOOD" | "ACCEPTABLE" | "NEEDS_REVIEW" | "POOR" {
  if (score >= 80) return "GOOD";
  if (score >= 65) return "ACCEPTABLE";
  if (score >= 45) return "NEEDS_REVIEW";
  return "POOR";
}

export function countUsableAssets(statuses: MediaAssetStatus[]): number {
  return statuses.filter((s) => s === "READY" || s === "NEEDS_REVIEW").length;
}
