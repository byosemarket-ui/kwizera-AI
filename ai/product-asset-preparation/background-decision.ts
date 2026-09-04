/**
 * STEP 6 — background preparation decisions.
 * Maps existing isolation policy; never claims unsupported ML matting.
 */
import type { IsolationDecision, PreparationDecision } from "../media-intelligence/isolation-policy.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";

export type BackgroundPrepDecision =
  | "KEEP_ORIGINAL_BACKGROUND"
  | "PREPARE_BACKGROUND_SEPARATION"
  | "PREPARE_CLEAN_COMPOSITION"
  | "BACKGROUND_UNAVAILABLE_OR_NOT_SUPPORTED";

export interface BackgroundDecisionResult {
  decision: BackgroundPrepDecision;
  isolationDecision: PreparationDecision;
  isolate: boolean;
  safe: boolean;
  confidence: number;
  reason: string;
  /** Honest capability flag — heuristic cutout only unless architecture expands. */
  reliableBackgroundRemovalAvailable: boolean;
  notes: string[];
}

/**
 * Source-preserving cutout exists in product-asset-preparation (color-distance heuristic).
 * It is not a production-grade ML matting model — decisions must stay honest.
 */
export function decideBackgroundPreparation(input: {
  isolation: IsolationDecision;
  profile?: ImageIntelligenceProfile | null;
}): BackgroundDecisionResult {
  const notes: string[] = [
    "Original product image bytes remain untouched.",
    "Background separation uses the existing source-preserving cutout path when isolation is approved.",
  ];
  const reliableBackgroundRemovalAvailable = false; // no production ML matting claimed
  notes.push("Reliable ML background removal is not claimed; heuristic isolation only when policy allows.");

  const { isolation, profile } = input;

  if (!profile) {
    return {
      decision: "BACKGROUND_UNAVAILABLE_OR_NOT_SUPPORTED",
      isolationDecision: isolation.decision,
      isolate: false,
      safe: true,
      confidence: 35,
      reason: "Image intelligence unavailable — keep original background.",
      reliableBackgroundRemovalAvailable,
      notes,
    };
  }

  if (isolation.decision === "KEEP_ORIGINAL") {
    return {
      decision: "KEEP_ORIGINAL_BACKGROUND",
      isolationDecision: isolation.decision,
      isolate: false,
      safe: true,
      confidence: Math.max(60, isolation.reason ? 70 : 60),
      reason: isolation.reason,
      reliableBackgroundRemovalAvailable,
      notes,
    };
  }

  if (isolation.decision === "REQUEST_USER_ATTENTION") {
    return {
      decision: "BACKGROUND_UNAVAILABLE_OR_NOT_SUPPORTED",
      isolationDecision: isolation.decision,
      isolate: false,
      safe: true,
      confidence: 55,
      reason: isolation.reason,
      reliableBackgroundRemovalAvailable,
      notes: [...notes, "User attention requested — do not force background removal."],
    };
  }

  if (isolation.decision === "REMOVE_BACKGROUND" && isolation.isolate) {
    return {
      decision: "PREPARE_BACKGROUND_SEPARATION",
      isolationDecision: isolation.decision,
      isolate: true,
      safe: true,
      confidence: Math.min(85, (profile.background.confidence ?? 50) + 10),
      reason: isolation.reason,
      reliableBackgroundRemovalAvailable,
      notes: [...notes, "Prepare derived foreground via existing cutout; original preserved."],
    };
  }

  if (isolation.decision === "REPLACE_BACKGROUND_LATER" || isolation.decision === "ENHANCE_SOURCE") {
    return {
      decision: "PREPARE_CLEAN_COMPOSITION",
      isolationDecision: isolation.decision,
      isolate: isolation.isolate,
      safe: true,
      confidence: Math.min(75, profile.background.confidence ?? 50),
      reason: isolation.reason,
      reliableBackgroundRemovalAvailable,
      notes: [...notes, "Composition metadata prepared; later stages may refine background."],
    };
  }

  if (isolation.decision === "REFRAME_PRODUCT") {
    return {
      decision: "PREPARE_CLEAN_COMPOSITION",
      isolationDecision: isolation.decision,
      isolate: false,
      safe: true,
      confidence: 65,
      reason: isolation.reason,
      reliableBackgroundRemovalAvailable,
      notes: [...notes, "Reframe via framing metadata — do not destroy product with aggressive crop."],
    };
  }

  return {
    decision: "KEEP_ORIGINAL_BACKGROUND",
    isolationDecision: isolation.decision,
    isolate: false,
    safe: true,
    confidence: 50,
    reason: isolation.reason || "Default to original background.",
    reliableBackgroundRemovalAvailable,
    notes,
  };
}
