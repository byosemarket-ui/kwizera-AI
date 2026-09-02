/**
 * Decide whether a product image should receive background isolation.
 * Clean studio shots are left untouched; complex backgrounds get a derived foreground candidate.
 */
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";

export interface IsolationDecision {
  isolate: boolean;
  reason: string;
}

export function decideIsolation(profile: ImageIntelligenceProfile | null | undefined): IsolationDecision {
  if (!profile) {
    return { isolate: false, reason: "Analysis unavailable — skip isolation until profile exists." };
  }
  if (!profile.background.removable) {
    return { isolate: false, reason: "Background is not removable — use original asset." };
  }

  const suitability = profile.background.removalSuitability ?? "unknown";
  if (suitability === "low") {
    return { isolate: false, reason: "Background separation confidence is low — keep original for review." };
  }

  const type = profile.background.type.toLowerCase();
  const complexity = profile.background.complexity ?? "unknown";
  const studioLike = /white studio|plain|studio background|clean/.test(type);

  if (studioLike && complexity !== "high" && suitability !== "high") {
    return { isolate: false, reason: "Clean studio background — original is suitable without isolation." };
  }

  if (suitability === "high" || suitability === "medium" || complexity === "high") {
    return { isolate: true, reason: "Complex or removable background — prepare isolated foreground." };
  }

  return { isolate: false, reason: "Isolation not required for this image." };
}
