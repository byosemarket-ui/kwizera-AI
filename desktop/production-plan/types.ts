/** Phase 4 Step 3 — Master Production Plan & Pre-Production Control */

import type { ClaimSafetyEntry, RestrictionItem, MasterProductIntelligence } from "../master-intelligence/types";
import type { MasterMarketingStrategy } from "../marketing-strategy/types";
import type { MasterCreativeBlueprint, ScenePlan, ScriptLine, StoryNarrative } from "../creative-planner/types";
import type { MarketingProductionBrief } from "../marketing-input/types";

export type PlanStatus = "idle" | "running" | "draft" | "review" | "confirmed" | "partial";
export type ReadinessLevel = "READY" | "READY WITH WARNINGS" | "BLOCKED";
export type AssetNeed = "CRITICAL" | "REQUIRED" | "OPTIONAL";
export type AssetAvail = "AVAILABLE" | "MISSING";

export type PlanStage =
  | "loaded"
  | "project"
  | "product"
  | "marketing"
  | "creative"
  | "timeline"
  | "assets"
  | "audio"
  | "visual"
  | "output"
  | "dependencies"
  | "claims"
  | "restrictions"
  | "consistency"
  | "readiness"
  | "checklist"
  | "saved";

export interface MarketingConflict {
  id: string;
  title: string;
  detail: string;
}

export interface TimelineEntry {
  sceneId: string;
  sceneNumber: number;
  name: string;
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface TimelineAudit {
  entries: TimelineEntry[];
  totalDurationSec: number;
  targetDurationSec: number;
  gaps: string[];
  overlaps: string[];
  valid: boolean;
}

export interface RequiredAsset {
  id: string;
  assetType: string;
  sceneId: string | null;
  sceneNumber: number | null;
  required: AssetNeed;
  status: AssetAvail;
  assetId: string | null;
  fileName: string | null;
  source: string;
  resolution: string;
  why: string;
  solution: string;
}

export interface AudioSpec {
  language: string;
  voiceType: string;
  tone: string;
  pace: string;
  emotion: string;
  musicStyle: string;
  musicMood: string;
  musicEnergy: string;
  bpmDirection: string;
  sfx: Array<{ effect: string; scene: string; trigger: string }>;
  voicePriority: string;
  musicLevel: string;
  sfxLevel: string;
  ducking: string;
  note: string;
}

export interface VisualSpec {
  resolution: string;
  aspectRatio: string;
  productPresentation: string;
  backgroundDirection: string;
  lighting: string;
  colorDirection: string;
  cameraStyle: string;
  motionStyle: string;
  typographyDirection: string;
  transitionStyle: string;
  brandPresentation: string;
}

export interface OutputConfig {
  types: string[];
  resolution: string;
  aspectRatio: string;
  frameRate: string;
  durationSec: number;
  codec: string;
  qualityPreset: string;
  outputDirectory: string;
  platformRecommendation: string;
}

export interface ProductionDependency {
  id: string;
  name: string;
  dependsOn: string[];
  ready: boolean;
  note: string;
}

export interface ClaimAuditItem {
  id: string;
  text: string;
  location: string;
  status: "SAFE / VERIFIED" | "SUPPORTED BUT REVIEW" | "UNVERIFIED" | "DO NOT USE";
  reason: string;
  blocks: boolean;
}

export interface ConsistencyWarning {
  id: string;
  relationship: string;
  detail: string;
}

export interface ReadinessScores {
  product: number;
  marketing: number;
  creative: number;
  assets: number;
  audio: number;
  claims: number;
  output: number;
  overall: number;
  explanation: string;
}

export interface ChecklistItem {
  id: string;
  group: string;
  label: string;
  ok: boolean;
  critical: boolean;
}

export interface VersionRefs {
  productVersion: string | null;
  marketingStrategyVersion: string | null;
  creativeBlueprintVersion: string | null;
  scriptVersion: string | null;
  sceneVersion: string | null;
  claimSafetyVersion: string | null;
  restrictionsVersion: string | null;
}

export interface MasterProductionPlan {
  version: 1;
  planId: string;
  versionLabel: string;
  versionNumber: number;
  engineId: string;
  projectId: string;
  productId: string;
  projectName: string;
  productName: string;
  campaignName: string;
  project: {
    campaignObjective: string;
    contentType: string;
    platforms: string[];
    audience: string;
    language: string;
    voice: string;
    tone: string;
    cta: string;
    promotion: string;
    durationSec: number;
    outputType: string;
  };
  product: {
    identity: string;
    category: string;
    variants: string[];
    specifications: string[];
    imageCount: number;
    features: string[];
    benefits: string[];
    differentiators: string[];
  };
  marketingConflicts: MarketingConflict[];
  story: StoryNarrative;
  script: ScriptLine[];
  scenes: ScenePlan[];
  timeline: TimelineAudit;
  assets: RequiredAsset[];
  audio: AudioSpec;
  visual: VisualSpec;
  output: OutputConfig;
  dependencies: ProductionDependency[];
  claimAudit: ClaimAuditItem[];
  restrictions: RestrictionItem[];
  consistency: ConsistencyWarning[];
  scores: ReadinessScores;
  readiness: ReadinessLevel;
  checklist: ChecklistItem[];
  blueprintRef: string;
  strategyRef: string;
  masterRef: string | null;
  versionRefs: VersionRefs;
  userConfirmed: boolean;
  confirmedAt: string | null;
  phase4Complete: boolean;
  readyForPhase5: boolean;
  lastError: string | null;
  history: Array<{ versionLabel: string; planId: string; createdAt: string; status: PlanStatus }>;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionSnapshot {
  snapshotId: string;
  createdAt: string;
  plan: MasterProductionPlan;
  versionRefs: VersionRefs;
  story: MasterCreativeBlueprint["story"];
  script: MasterCreativeBlueprint["script"];
  scenes: ScenePlan[];
  claimSafety: ClaimSafetyEntry[];
  strategy: MasterMarketingStrategy | null;
  master: MasterProductIntelligence | null;
  marketingBrief: MarketingProductionBrief | null;
}

export interface PlanProgress {
  total: number;
  completed: number;
  percent: number;
  currentLabel: string;
  currentStage: PlanStage | null;
  running: boolean;
}

export interface ProductionPlanSnapshot {
  version: 1;
  package: MasterProductionPlan | null;
  snapshot: ProductionSnapshot | null;
  progress: PlanProgress;
  recommendation: string;
  handoffReady: boolean;
  reviewOpen: boolean;
  updatedAt: string;
}

export interface Phase5ProductionHandoffPayload {
  version: 1;
  step: "phase-5-ai-production";
  phase4Complete: true;
  projectId: string;
  projectName: string;
  snapshot: ProductionSnapshot;
  preparedAt: string;
}

export const PLAN_STORE_KEY = "kwizera.production-plan.v1";
export const PLAN_HANDOFF_KEY = "kwizera.production-plan.handoff.v1";
export const PLAN_MEMORY_KEY = "kwizera.production-plan.memory.v1";
export const PLAN_SNAPSHOT_KEY = "kwizera.production-snapshot.v1";

export const PLAN_STAGES: PlanStage[] = [
  "loaded", "project", "product", "marketing", "creative", "timeline", "assets",
  "audio", "visual", "output", "dependencies", "claims", "restrictions",
  "consistency", "readiness", "checklist", "saved",
];

export const PLAN_STAGE_LABELS: Record<PlanStage, string> = {
  loaded: "Inputs loaded",
  project: "Project configuration",
  product: "Product configuration",
  marketing: "Marketing configuration",
  creative: "Creative configuration",
  timeline: "Scene timeline",
  assets: "Asset requirements",
  audio: "Audio specification",
  visual: "Visual specification",
  output: "Output configuration",
  dependencies: "Production dependencies",
  claims: "Claim audit",
  restrictions: "Restrictions",
  consistency: "Creative consistency",
  readiness: "Production readiness",
  checklist: "Pre-production checklist",
  saved: "Draft saved for review",
};
