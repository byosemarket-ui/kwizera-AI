/**
 * PMV video modes — the single authoritative customer-selected mode, plus the legacy mappings.
 * Shared by the Studio UI and the server-side PMV workflow orchestrator.
 *
 * `PmvVideoMode` is the canonical value persisted as `creativeDirection.videoMode`.
 * `PmvGenerationMode` is the pre-Phase-10 field; it is read only for projects saved before
 * `videoMode` existed (via `resolveStoredVideoMode`) and mirrored on write for older readers.
 * `ProductionModeId` is the render engine a mode executes with — derived, never chosen by customers.
 */
import type { ProductionModeId } from "../video-production/production-mode-types.js";

export type PmvVideoMode = "PRODUCT_SLIDESHOW" | "PRODUCT_3D_SHOWCASE" | "CINEMATIC_AI";

export const PMV_VIDEO_MODES: readonly PmvVideoMode[] = ["PRODUCT_SLIDESHOW", "PRODUCT_3D_SHOWCASE", "CINEMATIC_AI"];

/** Behaviour of every project saved before an explicit mode existed. */
export const DEFAULT_PMV_VIDEO_MODE: PmvVideoMode = "PRODUCT_SLIDESHOW";

export const PMV_VIDEO_MODE_COPY: Record<PmvVideoMode, { label: string; description: string }> = {
  PRODUCT_SLIDESHOW: {
    label: "Product Slideshow",
    description: "Turn your product photos into a polished promotional video.",
  },
  PRODUCT_3D_SHOWCASE: {
    label: "3D Product Showcase",
    description: "Present your product with a 3D/360-style visual experience.",
  },
  CINEMATIC_AI: {
    label: "Cinematic AI Advertisement",
    description: "Create cinematic AI-generated product scenes.",
  },
};

export type PmvGenerationMode =
  | "EXACT_PRODUCT"
  | "CINEMATIC"
  | "ADVANCED_CREATIVE";

export function isPmvVideoMode(value: unknown): value is PmvVideoMode {
  return typeof value === "string" && (PMV_VIDEO_MODES as readonly string[]).includes(value);
}

/** Deterministic legacy mapping: both photo-based legacy modes are the slideshow route; only CINEMATIC was generative. */
export function videoModeFromGenerationMode(mode: unknown): PmvVideoMode {
  return mode === "CINEMATIC" ? "CINEMATIC_AI" : DEFAULT_PMV_VIDEO_MODE;
}

/** The mode a stored creative direction means — explicit `videoMode` wins, legacy `generationMode` otherwise. */
export function resolveStoredVideoMode(direction: { videoMode?: unknown; generationMode?: unknown } | null | undefined): PmvVideoMode {
  if (isPmvVideoMode(direction?.videoMode)) return direction.videoMode;
  return videoModeFromGenerationMode(direction?.generationMode);
}

/** Legacy field value to mirror on write; null when the mode has no legacy equivalent. */
export function legacyGenerationMode(mode: PmvVideoMode): PmvGenerationMode | null {
  if (mode === "PRODUCT_SLIDESHOW") return "EXACT_PRODUCT";
  if (mode === "CINEMATIC_AI") return "CINEMATIC";
  return null;
}

/** Render engine for a mode; null when the mode has no executable engine yet. */
export function productionModeForVideoMode(mode: PmvVideoMode): ProductionModeId | null {
  if (mode === "PRODUCT_SLIDESHOW") return "AI_PRODUCT_MOTION";
  if (mode === "CINEMATIC_AI") return "CINEMATIC_3D";
  return null;
}

export function mapPmvModeToProduction(mode: PmvGenerationMode): ProductionModeId {
  if (mode === "CINEMATIC") return "CINEMATIC_3D";
  if (mode === "ADVANCED_CREATIVE") return "CLASSIC_SHOWCASE";
  return "AI_PRODUCT_MOTION";
}

export function mapProductionToPmvMode(mode: ProductionModeId | null | undefined): PmvGenerationMode {
  if (mode === "CINEMATIC_3D") return "CINEMATIC";
  if (mode === "CLASSIC_SHOWCASE") return "ADVANCED_CREATIVE";
  return "EXACT_PRODUCT";
}
