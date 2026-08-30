import type { CreativeToneId, ProductionModeId } from "../../ai/video-production/production-mode-types.js";
import type { VideoPlatformId } from "../../ai/video-production/platform-profiles.js";
import type { CreativePlanSceneDto, CreativePlanDto, ProductionManifestDto } from "../deep-intelligence/live-api.js";
import type { Step3HandoffPayload } from "../video-requirements/types.js";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export interface ProductionModeOption {
  mode: ProductionModeId;
  label: string;
  description: string;
  available: boolean;
  provider: string;
  reason: string;
  limitations: string[];
  recommended: boolean;
}

export interface ProjectSummary {
  productId: string;
  productName: string;
  heroUrl: string | null;
  platformLabel: string;
  platformId: VideoPlatformId;
  aspectRatio: string;
  width: number;
  height: number;
  durationSeconds: number;
  priceLabel: string | null;
  discountLabel: string | null;
  website: string | null;
  objective: string;
  language: string;
}

export interface PlanPreview {
  ready: boolean;
  headline: string;
  sceneCount: number;
  uniqueViewCount: number;
  formatLabel: string;
  includesPrice: boolean;
  includesDiscount: boolean;
  includesWebsite: boolean;
  includesCta: boolean;
  statusLabel: string;
}

export interface ScenePreview {
  id: string;
  order: number;
  purpose: string;
  beat: string;
  view: string;
  durationSeconds: number;
  motion: string;
  transition: string;
  textPreview: string;
  assetId: string;
  thumbnailUrl: string;
  selectionReason: string;
  userEdited: boolean;
}

export interface ReadinessResult {
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
  statusLabel: string;
}

export interface VideoStyleSnapshot {
  version: 1;
  projectId: string | null;
  projectName: string;
  handoff: Step3HandoffPayload | null;
  summary: ProjectSummary | null;
  modes: ProductionModeOption[];
  selectedMode: ProductionModeId | null;
  recommendedReason: string | null;
  creativeTone: CreativeToneId | null;
  toneOptions: CreativeToneId[];
  plan: CreativePlanDto | null;
  manifest: ProductionManifestDto | null;
  planPreview: PlanPreview | null;
  scenes: ScenePreview[];
  generating: boolean;
  saveState: SaveState;
  readiness: ReadinessResult;
  canContinue: boolean;
  continueBlockedReason: string | null;
  updatedAt: string;
}

export interface Step4HandoffPayload {
  version: 1;
  step: "step-4-final-review";
  projectId: string;
  projectName: string;
  briefId: string;
  productId: string;
  planId: string;
  manifestId: string | null;
  assetIds: string[];
  productionMode: ProductionModeId;
  creativeTone: CreativeToneId | null;
  platformId: VideoPlatformId;
  durationSeconds: number;
  sceneCount: number;
  preparedAt: string;
}

export const STEP4_HANDOFF_KEY = "kwizera.video-style.handoff.v1";

export const TONE_OPTIONS: CreativeToneId[] = ["Premium", "Modern", "Energetic", "Minimal", "Luxury"];

export type { CreativePlanSceneDto };
