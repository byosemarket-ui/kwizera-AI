/**
 * Product Marketing Video Step 3 — Creative direction, plan, storyboard, generation.
 * Reuses CreativePlanningManager + VideoProductionManager (no second renderer).
 */

import type { CreativeToneId, ProductionModeId } from "../../ai/video-production/production-mode-types";
import type { CreativePlanDto, CreativePlanSceneDto } from "../deep-intelligence/live-api";

export type PmvCreativeGoal =
  | "product_showcase"
  | "drive_orders"
  | "brand_awareness"
  | "promo_offer";

export type PmvCreativeEnergy =
  | "calm"
  | "balanced"
  | "energetic"
  | "aggressive";

export type PmvGenerationMode =
  | "EXACT_PRODUCT"
  | "CINEMATIC"
  | "ADVANCED_CREATIVE";

export type PmvCreativeStatus =
  | "NOT_STARTED"
  | "PLANNING"
  | "PLAN_READY"
  | "GENERATING"
  | "VIDEO_READY"
  | "FAILED"
  | "STALE";

export interface PmvCreativeDirection {
  goal: PmvCreativeGoal;
  audience: string;
  mood: string;
  energy: PmvCreativeEnergy;
  visualStyle: string;
  generationMode: PmvGenerationMode;
  creativeTone: CreativeToneId;
  musicPreference: string;
  voicePreference: string;
  desiredMotion: string;
}

export interface PmvModeCapabilityView {
  mode: PmvGenerationMode;
  productionMode: ProductionModeId;
  label: string;
  description: string;
  available: boolean;
  reason: string;
  limitations: string[];
  recommended?: boolean;
}

export interface PmvStoryboardSceneView {
  sceneId: string;
  order: number;
  durationSeconds: number;
  purpose: string;
  visual: string;
  camera: string;
  motion: string;
  transition: string;
  text: string;
  assetId: string | null;
  status: "PLANNED" | "READY" | "GENERATING" | "GENERATED" | "FAILED" | "STALE";
}

/** Structured audio prep for Step 4 — not full audio production. */
export interface PmvAudioRequirements {
  musicMood: string;
  genre: string;
  energy: PmvCreativeEnergy;
  tempo: "slow" | "medium" | "fast";
  voiceRequired: boolean;
  narrationRequired: boolean;
  audioPurpose: string;
  musicPreference: string;
  voicePreference: string;
}

export interface PmvCreativeState {
  status: PmvCreativeStatus;
  direction: PmvCreativeDirection;
  planId: string | null;
  planVersion: number | null;
  planStatus: string | null;
  productionMode: ProductionModeId | null;
  scenes: PmvStoryboardSceneView[];
  capabilities: PmvModeCapabilityView[];
  jobId: string | null;
  videoReady: boolean;
  outputAvailable: boolean;
  errorMessage: string | null;
  cinematicUnavailableMessage: string | null;
  advancedUnavailableMessage: string | null;
  audioRequirements: PmvAudioRequirements | null;
}

export const DEFAULT_PMV_CREATIVE_DIRECTION = (): PmvCreativeDirection => ({
  goal: "product_showcase",
  audience: "Product shoppers",
  mood: "Premium and clear",
  energy: "balanced",
  visualStyle: "Product-focused",
  generationMode: "EXACT_PRODUCT",
  creativeTone: "Modern",
  musicPreference: "Light marketing bed (Step 4)",
  voicePreference: "Optional narration (Step 4)",
  desiredMotion: "Controlled product motion",
});

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

export function pmvModeLabel(mode: PmvGenerationMode): string {
  if (mode === "CINEMATIC") return "Cinematic";
  if (mode === "ADVANCED_CREATIVE") return "Advanced creative";
  return "Exact product";
}

export function toneFromEnergy(energy: PmvCreativeEnergy, goal: PmvCreativeGoal): CreativeToneId {
  if (energy === "aggressive" || goal === "promo_offer") return "Energetic";
  if (energy === "calm") return "Minimal";
  if (energy === "energetic") return "Energetic";
  if (goal === "brand_awareness") return "Modern";
  return "Premium";
}

export function scenesFromPlan(plan: CreativePlanDto | null): PmvStoryboardSceneView[] {
  if (!plan?.scenes?.length) return [];
  return plan.scenes.map((scene: CreativePlanSceneDto) => ({
    sceneId: scene.id,
    order: scene.order,
    durationSeconds: scene.durationSeconds
      || (scene.durationMs ? Math.round(scene.durationMs / 1000) : 0),
    purpose: scene.purpose || scene.beat || "Scene",
    visual: scene.visual || scene.visualPurpose || "",
    camera: scene.camera || scene.cameraDirection || "",
    motion: scene.motion || scene.animation || "",
    transition: scene.transition || "cut",
    text: scene.text
      || scene.copy?.headline
      || scene.copy?.callToAction
      || scene.narration
      || "",
    assetId: scene.assetId ?? null,
    status: "PLANNED",
  }));
}

export function customerSafeError(raw: string): string {
  const text = raw.trim() || "Creative production failed.";
  if (/api.?key|credential|token|secret|ollama|provider|wan|flux|sam2/i.test(text)) {
    return "Video generation is unavailable right now. Try Exact Product mode or try again later.";
  }
  return text;
}

export function audioRequirementsFromDirection(direction: PmvCreativeDirection): PmvAudioRequirements {
  const tempo: PmvAudioRequirements["tempo"] =
    direction.energy === "calm" ? "slow"
      : direction.energy === "energetic" || direction.energy === "aggressive" ? "fast"
        : "medium";
  const wantsVoice = /narrat|voice|speak/i.test(direction.voicePreference);
  return {
    musicMood: direction.mood || "Premium and clear",
    genre: direction.musicPreference || "Light marketing bed",
    energy: direction.energy,
    tempo,
    voiceRequired: wantsVoice,
    narrationRequired: wantsVoice,
    audioPurpose: "Support product advertisement pacing (prepared for Step 4)",
    musicPreference: direction.musicPreference,
    voicePreference: direction.voicePreference,
  };
}
