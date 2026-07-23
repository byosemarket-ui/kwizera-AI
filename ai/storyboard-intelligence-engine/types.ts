/**
 * KWIZERA AI STUDIO — Storyboard Intelligence Engine types (Step 5G)
 */

import type { CreativePlatform, CreativeDirectionStyle } from "../creative-direction-engine/types.js";
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";

export type StoryboardPlatform = CreativePlatform;

export interface StoryboardProfile {
  storyboardId: string;
  projectId: string;
  product: string;
  brand: string;
  campaignGoal: MarketingObjective;
  targetAudience: string;
  platform: StoryboardPlatform;
  storyboardVersion: number;
  totalScenes: number;
  estimatedDuration: string;
  creativeStyle: CreativeDirectionStyle;
}

export interface ScenePlan {
  sceneNumber: number;
  scenePurpose: string;
  estimatedDuration: string;
  visualObjective: string;
  productFocus: string;
  cameraDirection: string;
  backgroundStyle: string;
  lightingDirection: string;
  composition: string;
  motionDirection: string;
  transitionIn: string;
  transitionOut: string;
  textPlacement: string;
  subtitleArea: string;
  ctaPlacement: string;
  emotionalGoal: string;
}

export interface StoryFlow {
  opening: string;
  hook: string;
  productIntroduction: string;
  featurePresentation: string;
  benefitDemonstration: string;
  customerValue: string;
  socialProof: string;
  offerPresentation: string;
  callToAction: string;
  ending: string;
}

export interface PlatformStoryboardRules {
  platform: StoryboardPlatform;
  recommendedSceneCount: number;
  maxDuration: string;
  pacingRules: string[];
  sceneDurationGuidance: string;
}

export interface TimingIntelligence {
  sceneTiming: Record<number, string>;
  transitionTiming: string;
  hookTiming: string;
  ctaTiming: string;
  endingTiming: string;
  totalEstimatedSeconds: number;
}

export interface ContinuityCheck {
  sceneConsistency: boolean;
  brandConsistency: boolean;
  creativeConsistency: boolean;
  productConsistency: boolean;
  storyConsistency: boolean;
  issues: string[];
  recommendations: string[];
}

export interface StoryboardScores {
  storyboardQualityScore: number;
  storytellingScore: number;
  visualPlanningScore: number;
  marketingScore: number;
  brandConsistencyScore: number;
  aiConfidenceScore: number;
}

export interface StoryboardRelationships {
  creativeDirections: string[];
  products: string[];
  brands: string[];
  marketingStrategies: string[];
  scripts: string[];
  visualPlans: string[];
  audioPlans: string[];
  productionPlans: string[];
  knowledgeRecords: string[];
}

export interface StoryboardIntelligenceInput {
  productId: string;
  storyboardId?: string;
  creativeId?: string;
  projectId?: string;
  includeSocialProof?: boolean;
}

export interface StoryboardIntelligenceRecord {
  storyboardId: string;
  productId: string;
  projectId: string;
  creativeId: string;
  strategyId: string;
  profile: StoryboardProfile;
  scenes: ScenePlan[];
  storyFlow: StoryFlow;
  platformRules: PlatformStoryboardRules;
  timing: TimingIntelligence;
  continuity: ContinuityCheck;
  scores: StoryboardScores;
  relationships: StoryboardRelationships;
  validated: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
  version: number;
}

export interface StoryboardIntelligenceResult {
  success: boolean;
  record?: StoryboardIntelligenceRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface StoryboardSearchQuery {
  storyboardId?: string;
  scenePurpose?: string;
  campaignGoal?: MarketingObjective;
  brand?: string;
  productId?: string;
  platform?: StoryboardPlatform;
  creativeStyle?: CreativeDirectionStyle;
  audience?: string;
  text?: string;
  limit?: number;
}

export interface StoryboardIntelligenceEngineStatusReport {
  engineStatus: string;
  storyboardPlanningStatus: string;
  scenePlanningStatus: string;
  continuityStatus: string;
  storyboardsPrepared: number;
  averageStoryboardQualityScore: number;
  averageStorytellingScore: number;
  performance: {
    averagePlanningMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class StoryboardIntelligenceEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "StoryboardIntelligenceEngineError";
  }
}
