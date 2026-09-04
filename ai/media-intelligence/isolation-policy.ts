/**
 * Decide how a product image should be prepared for video.
 * Clean studio shots stay original; only remove/replace when analysis supports it.
 */
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";

export type PreparationDecision =
  | "KEEP_ORIGINAL"
  | "REMOVE_BACKGROUND"
  | "REPLACE_BACKGROUND_LATER"
  | "ENHANCE_SOURCE"
  | "REFRAME_PRODUCT"
  | "REQUEST_USER_ATTENTION";

export interface IsolationDecision {
  isolate: boolean;
  reason: string;
  decision: PreparationDecision;
}

export function decideIsolation(profile: ImageIntelligenceProfile | null | undefined): IsolationDecision {
  if (!profile) {
    return {
      isolate: false,
      reason: "Analysis unavailable — skip isolation until profile exists.",
      decision: "KEEP_ORIGINAL",
    };
  }

  const quality = profile.quality.classification ?? "ACCEPTABLE";
  if (quality === "POOR" || (profile.quality.score ?? 100) < 45) {
    return {
      isolate: false,
      reason: "Image quality is too low for safe isolation — keep original and request attention.",
      decision: "REQUEST_USER_ATTENTION",
    };
  }

  const framing = profile.visibility?.framing ?? "";
  const cutoff = Boolean(profile.visibility?.cutoff);
  const smallInFrame = /small in frame/i.test(framing);
  if (cutoff || smallInFrame || profile.visibility?.status === "needs-review") {
    return {
      isolate: false,
      reason: cutoff
        ? "Product near edge / cut-off risk — prepare reframe metadata; keep original pixels."
        : "Product framing needs adjustment — prepare reframe metadata without isolating.",
      decision: "REFRAME_PRODUCT",
    };
  }

  if (!profile.background.removable) {
    return {
      isolate: false,
      reason: "Background is not removable — use original asset.",
      decision: "KEEP_ORIGINAL",
    };
  }

  const suitability = profile.background.removalSuitability ?? "unknown";
  if (suitability === "low") {
    return {
      isolate: false,
      reason: "Background separation confidence is low — keep original for review.",
      decision: "REQUEST_USER_ATTENTION",
    };
  }

  const type = profile.background.type.toLowerCase();
  const complexity = profile.background.complexity ?? "unknown";
  const studioLike = /white studio|plain|studio background|clean/.test(type);

  if (studioLike && complexity !== "high" && suitability !== "high") {
    return {
      isolate: false,
      reason: "Clean studio background — original is suitable without isolation.",
      decision: "KEEP_ORIGINAL",
    };
  }

  if (suitability === "high" || suitability === "medium" || complexity === "high") {
    return {
      isolate: true,
      reason: "Complex or removable background — prepare isolated foreground.",
      decision: suitability === "high" ? "REMOVE_BACKGROUND" : "REPLACE_BACKGROUND_LATER",
    };
  }

  return {
    isolate: false,
    reason: "Isolation not required for this image.",
    decision: "KEEP_ORIGINAL",
  };
}
