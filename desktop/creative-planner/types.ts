/** Phase 4 Step 2 — Story, Script & Creative Production Planner */

import type { ClaimSafetyEntry, RestrictionItem, MasterProductIntelligence } from "../master-intelligence/types";
import type { MasterMarketingStrategy } from "../marketing-strategy/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import type { OrganizationViewType } from "../image-organization/types";

export type PlannerStatus = "idle" | "running" | "draft" | "review" | "confirmed" | "partial";

export type StoryBeatId =
  | "HOOK"
  | "PROBLEM"
  | "PRODUCT_INTRO"
  | "FEATURES"
  | "BENEFITS"
  | "PROOF"
  | "LIFESTYLE"
  | "OFFER"
  | "CTA"
  | "ENDING";

export type AssetAction = "use-existing" | "request-new" | "generate-later" | "skip";

export type PlannerStage =
  | "loaded"
  | "content-type"
  | "objective"
  | "hooks"
  | "structure"
  | "story"
  | "script"
  | "claims"
  | "scenes"
  | "assets"
  | "visual"
  | "camera"
  | "narration"
  | "text"
  | "audio"
  | "timing"
  | "platform"
  | "cta"
  | "style"
  | "storyboard"
  | "alternatives"
  | "validation"
  | "saved";

export interface ClaimFlag {
  id: string;
  text: string;
  claim: string;
  status: "SUPPORTED BUT REVIEW" | "UNVERIFIED" | "DO NOT USE";
  reason: string;
  sceneId: string | null;
}

export interface HookOption {
  id: string;
  kind: "problem" | "question" | "visual" | "reveal" | "benefit" | "promotion";
  text: string;
  concept: string;
  audienceRelevance: string;
  marketingAngle: string;
  evidence: string;
  confidence: number;
}

export interface StoryBeat {
  id: StoryBeatId;
  name: string;
  included: boolean;
  reason: string;
}

export interface AssetRef {
  status: "mapped" | "MISSING ASSET";
  fileName: string | null;
  assetId: string | null;
  viewType: OrganizationViewType | null;
  recommendation: AssetAction | null;
  note: string;
}

export interface ScenePlan {
  id: string;
  sceneNumber: number;
  name: string;
  beat: StoryBeatId;
  purpose: string;
  storyFunction: string;
  productFocus: string;
  sourceAsset: AssetRef;
  visualDescription: string;
  composition: string;
  framing: string;
  productPlacement: string;
  background: string;
  lighting: string;
  colorMood: string;
  visualEmphasis: string;
  depth: string;
  focus: string;
  motion: string;
  cameraDirection: string;
  cameraMovement: string;
  subjectMovement: string;
  onScreenText: string;
  narration: string;
  audioDirection: string;
  transition: string;
  durationSec: number;
  startSec: number;
  endSec: number;
  requiredAssets: string[];
  claimReferences: string[];
  claimFlags: ClaimFlag[];
  confidence: number;
  productionNotes: string;
}

export interface ScriptLine {
  sceneId: string;
  sceneNumber: number;
  narration: string;
  onScreenText: string;
  durationSec: number;
  cta: string | null;
  flags: ClaimFlag[];
}

export interface StoryNarrative {
  beginning: string;
  development: string;
  productPresentation: string;
  benefitDemonstration: string;
  conclusion: string;
  cta: string;
  fullStory: string;
}

export interface CreativeStyleProfile {
  visualStyle: string;
  colorDirection: string;
  lighting: string;
  cameraStyle: string;
  motionStyle: string;
  typographyDirection: string;
  transitionStyle: string;
  audioMood: string;
  narrationStyle: string;
}

export interface NarrationDirection {
  voiceType: string;
  gender: string;
  ageImpression: string;
  energy: string;
  emotion: string;
  pace: string;
  language: string;
  professionalism: string;
  note: string;
}

export interface AudioBlueprint {
  musicMood: string;
  musicEnergy: string;
  beatDirection: string;
  soundEffects: string;
  productSounds: string;
  voiceMusicBalance: string;
  transitionSounds: string;
  note: string;
}

export interface PlatformAdaptation {
  platform: string;
  notes: string[];
  recommendation: boolean;
}

export interface CtaScenePlan {
  text: string;
  visual: string;
  productPresentation: string;
  offer: string;
  contact: string;
  durationSec: number;
}

export interface PromotionPlan {
  included: boolean;
  status: "CONFIGURED" | "NONE" | "AI RECOMMENDATION — REQUIRES USER APPROVAL";
  details: string;
}

export interface StoryAlternative {
  id: string;
  name: string;
  angle: string;
  summary: string;
}

export interface CtaAlternative {
  id: string;
  text: string;
  source: "USER" | "AI RECOMMENDATION";
}

export interface ValidationCheck {
  id: string;
  label: string;
  ok: boolean;
  critical: boolean;
  detail: string;
}

export interface CreativeValidation {
  checks: ValidationCheck[];
  readinessPercent: number;
  canConfirm: boolean;
  blocking: string[];
  warnings: string[];
}

export interface PlannerRefs {
  projectId: string;
  productId: string;
  masterIntelligenceId: string | null;
  marketingStrategyId: string | null;
}

export interface MasterCreativeBlueprint {
  version: 1;
  blueprintId: string;
  versionLabel: string;
  versionNumber: number;
  engineId: string;
  projectId: string;
  productId: string;
  projectName: string;
  productName: string;
  refs: PlannerRefs;
  contentType: string;
  contentTypeUser: string;
  contentTypeAiRec: string | null;
  storyObjective: string;
  hooks: HookOption[];
  primaryHookId: string | null;
  storyBeats: StoryBeat[];
  story: StoryNarrative;
  script: ScriptLine[];
  scenes: ScenePlan[];
  style: CreativeStyleProfile;
  narrationDirection: NarrationDirection;
  audio: AudioBlueprint;
  platforms: PlatformAdaptation[];
  language: string;
  voice: string;
  cta: CtaScenePlan;
  ctaAlternatives: CtaAlternative[];
  selectedCtaId: string | null;
  promotion: PromotionPlan;
  storyAlternatives: StoryAlternative[];
  selectedStoryAltId: string | null;
  claimFlags: ClaimFlag[];
  restrictions: RestrictionItem[];
  missingAssets: AssetRef[];
  targetDurationSec: number;
  totalDurationSec: number;
  validation: CreativeValidation;
  userConfirmed: boolean;
  confirmedAt: string | null;
  readyForPreProduction: boolean;
  lastError: string | null;
  history: Array<{ versionLabel: string; blueprintId: string; createdAt: string; status: PlannerStatus }>;
  status: PlannerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerProgress {
  total: number;
  completed: number;
  percent: number;
  currentLabel: string;
  currentStage: PlannerStage | null;
  running: boolean;
}

export interface CreativePlannerSnapshot {
  version: 1;
  package: MasterCreativeBlueprint | null;
  progress: PlannerProgress;
  recommendation: string;
  handoffReady: boolean;
  reviewOpen: boolean;
  updatedAt: string;
  livePlan?: import("../deep-intelligence/live-api").CreativePlanDto | null;
  projectId?: string | null;
}

export interface Step3PreProductionHandoffPayload {
  version: 1;
  step: "step-3-final-production-plan";
  projectId: string;
  projectName: string;
  blueprint: MasterCreativeBlueprint;
  strategy: MasterMarketingStrategy | null;
  master: MasterProductIntelligence | null;
  marketingBrief: MarketingProductionBrief | null;
  claimSafety: ClaimSafetyEntry[];
  productionRestrictions: RestrictionItem[];
  preparedAt: string;
}

export const PLANNER_STORE_KEY = "kwizera.creative-planner.v1";
export const PLANNER_HANDOFF_KEY = "kwizera.creative-planner.handoff.v1";
export const PLANNER_MEMORY_KEY = "kwizera.creative-planner.memory.v1";

export const PLANNER_STAGES: PlannerStage[] = [
  "loaded", "content-type", "objective", "hooks", "structure", "story", "script", "claims",
  "scenes", "assets", "visual", "camera", "narration", "text", "audio", "timing",
  "platform", "cta", "style", "storyboard", "alternatives", "validation", "saved",
];

export const PLANNER_STAGE_LABELS: Record<PlannerStage, string> = {
  loaded: "Inputs loaded",
  "content-type": "Content type",
  objective: "Story objective",
  hooks: "Hook engine",
  structure: "Story structure",
  story: "Story development",
  script: "Script",
  claims: "Claim safety",
  scenes: "Scene plan",
  assets: "Asset mapping",
  visual: "Visual direction",
  camera: "Camera direction",
  narration: "Narration",
  text: "On-screen text",
  audio: "Audio direction",
  timing: "Timing",
  platform: "Platform adaptation",
  cta: "CTA scene",
  style: "Creative style",
  storyboard: "Storyboard data",
  alternatives: "Creative alternatives",
  validation: "Creative validation",
  saved: "Draft saved for review",
};
