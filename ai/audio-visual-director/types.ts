/**
 * STEP 2F — Audio-Visual Creative Director contracts.
 * Decision/orchestration layer only — does not render or invent beats.
 */

export const AV_CREATIVE_DIRECTOR_VERSION = "av-creative-director-v1";

export type AvCreativeMode =
  | "CALM"
  | "BALANCED"
  | "ENERGETIC"
  | "AGGRESSIVE"
  | "CINEMATIC"
  | "PRODUCT_FOCUSED"
  | "CUSTOM";

export type AvDirectorStatus =
  | "DIRECTOR_IDLE"
  | "DIRECTOR_ANALYZING"
  | "DIRECTOR_READY"
  | "DIRECTOR_LOW_CONFIDENCE"
  | "DIRECTOR_FALLBACK"
  | "DIRECTOR_RENDERING"
  | "DIRECTOR_FAILED";

export type AvConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AvEventType =
  | "INTRO"
  | "HOOK"
  | "PRODUCT_REVEAL"
  | "FEATURE_REVEAL"
  | "BENEFIT_REVEAL"
  | "DETAIL_REVEAL"
  | "PRICE_REVEAL"
  | "OFFER_REVEAL"
  | "TRANSITION"
  | "BEAT_HIT"
  | "STRONG_BEAT"
  | "DOWNBEAT"
  | "ENERGY_RISE"
  | "ENERGY_DROP"
  | "PAUSE"
  | "CTA"
  | "END_CARD";

export type ProductImportanceCategory =
  | "HERO_PRODUCT"
  | "SECONDARY_PRODUCT"
  | "DETAIL"
  | "PACKAGING"
  | "FEATURE"
  | "LIFESTYLE"
  | "SUPPORTING";

export type VisualEnergyBand =
  | "very_calm"
  | "calm"
  | "balanced"
  | "energetic"
  | "peak";

export type RevealStrategy =
  | "immediate"
  | "beat"
  | "gradual"
  | "cinematic"
  | "feature_first"
  | "detail_first";

export type IntensityLevel = "LOW" | "MEDIUM" | "HIGH";

export interface VisualEnergySample {
  startMs: number;
  endMs: number;
  energy: number;
  band: VisualEnergyBand;
}

export interface VisualEnergyProfile {
  version: "visual-energy-v1";
  samples: VisualEnergySample[];
  meanEnergy: number | null;
  peakEnergy: number | null;
  source: "AUDIO_TIMELINE" | "UNAVAILABLE" | "FALLBACK";
}

export interface AvTextSafetyWindow {
  sceneId: string;
  kind: "feature" | "benefit" | "cta" | "price" | "headline" | "end_card";
  minDurationMs: number;
  preferredDurationMs: number;
  maxDurationMs: number;
  safeStartMs: number;
  safeEndMs: number;
  lockedAgainstBeatCuts: true;
}

export interface AvSceneDecision {
  sceneId: string;
  clipId: string;
  startTime: number;
  endTime: number;
  duration: number;
  sceneRole: string;
  productImportance: ProductImportanceCategory;
  productImportanceScore: number;
  beatRelationship: string;
  energyLevel: number;
  energyBand: VisualEnergyBand;
  motionIntensity: IntensityLevel;
  cameraIntensity: IntensityLevel;
  transitionType: "cut" | "fade";
  transitionDuration: number;
  visualEmphasis: "none" | "subtle" | "strong";
  textSafety: boolean;
  confidence: AvConfidence;
  reasoning: string;
}

export interface AvMotionDecision {
  sceneId: string;
  intensity: IntensityLevel;
  preferredMotionFamily: "subtle" | "controlled" | "energetic" | "stable";
  reasoning: string;
}

export interface AvCameraDecision {
  sceneId: string;
  intensity: IntensityLevel;
  preferredMode: "static" | "slow_push" | "controlled" | "strong_push";
  reasoning: string;
}

export interface AvTransitionDecision {
  fromSceneId: string;
  toSceneId: string;
  type: "cut" | "fade";
  durationMs: number;
  beatAligned: boolean;
  reasoning: string;
}

export interface AvEmphasisEvent {
  eventId: string;
  type: AvEventType;
  timeMs: number;
  sceneId: string | null;
  strength: number;
  reasoning: string;
}

export interface HookTimingDecision {
  preferredStartMs: number;
  alignedBeatMs: number | null;
  strategy: RevealStrategy;
  reasoning: string;
}

export interface ProductRevealDecision {
  sceneId: string;
  strategy: RevealStrategy;
  timeMs: number;
  beatAligned: boolean;
  reasoning: string;
}

export interface CtaTimingDecision {
  sceneId: string | null;
  startMs: number;
  endMs: number;
  minReadableMs: number;
  reasoning: string;
}

export interface EndCardTimingDecision {
  sceneId: string | null;
  startMs: number;
  endMs: number;
  minReadableMs: number;
  alignedToAudioEnding: boolean;
  reasoning: string;
}

export interface PacingQualityReport {
  cutDensity: number;
  beatAlignment: number;
  energyAlignment: number;
  readabilityScore: number;
  productEmphasisScore: number;
  transitionVariety: number;
  overallScore: number;
}

export interface AvBalanceReport {
  audioScore: number;
  visualScore: number;
  marketingScore: number;
  uxScore: number;
  overallScore: number;
  notes: string[];
}

export interface AvDirectorOverrides {
  lockSceneTiming?: boolean;
  lockProductReveal?: boolean;
  lockCtaTiming?: boolean;
  disableBeatSync?: boolean;
  disableEnergySync?: boolean;
  reduceMotion?: boolean;
  reduceTransitions?: boolean;
  forceMode?: AvCreativeMode | null;
}

export interface AvDirectorSettings {
  creativeMode: AvCreativeMode;
  overrides: AvDirectorOverrides;
}

export interface AudioVisualCreativePlan {
  planId: string;
  projectId: string;
  version: typeof AV_CREATIVE_DIRECTOR_VERSION;
  audioAssetId: string | null;
  audioTimelineVersion: string | null;
  beatTimingPlanVersion: string | null;
  storyboardVersion: number | null;
  targetDuration: number;
  aspectRatio: string;
  creativeMode: AvCreativeMode;
  confidence: AvConfidence;
  status: AvDirectorStatus;
  scenes: AvSceneDecision[];
  transitions: AvTransitionDecision[];
  motionDecisions: AvMotionDecision[];
  cameraDecisions: AvCameraDecision[];
  emphasisEvents: AvEmphasisEvent[];
  textSafetyWindows: AvTextSafetyWindow[];
  productRevealEvents: ProductRevealDecision[];
  hookEvents: HookTimingDecision[];
  CTAEvents: CtaTimingDecision[];
  endCardTiming: EndCardTimingDecision | null;
  energyProfile: VisualEnergyProfile;
  pacing: PacingQualityReport;
  balance: AvBalanceReport;
  overrides: AvDirectorOverrides;
  fallbackReason: string | null;
  cacheKey: string;
  generatedAt: string;
  generationMs: number;
}

export interface AvQualityGateResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
}

export class AvDirectorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "AvDirectorError";
  }
}
