/**
 * KWIZERA AI STUDIO — Script Planning Engine types (Step 5H)
 */

import type { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";

export type ScriptPlanningPlatform = CreativePlatform;

export interface ScriptPlanningProfile {
  scriptPlanId: string;
  projectId: string;
  storyboardId: string;
  product: string;
  brand: string;
  campaignGoal: MarketingObjective;
  platform: ScriptPlanningPlatform;
  language: string;
  estimatedDuration: string;
  scriptVersion: number;
  targetAudience: string;
}

export interface SceneScriptPlan {
  sceneNumber: number;
  scenePurpose: string;
  messageObjective: string;
  keyProductBenefit: string;
  plannedNarration: string;
  plannedOnScreenText: string;
  plannedSubtitle: string;
  plannedCta: string;
  estimatedReadingTime: string;
  estimatedDisplayTime: string;
  emotionalTone: string;
}

export interface ScriptStructure {
  opening: string;
  hook: string;
  productIntroduction: string;
  featurePresentation: string;
  benefitPresentation: string;
  customerValue: string;
  brandMessage: string;
  offer: string;
  callToAction: string;
  closing: string;
}

export interface VoicePreparation {
  voiceStyle: string;
  narrationStyle: string;
  speakingSpeed: string;
  emotionalTone: string;
  pauseLocations: string[];
  emphasisPoints: string[];
}

export interface SubtitlePreparation {
  subtitleTiming: Record<number, string>;
  subtitlePosition: string;
  readingDuration: Record<number, string>;
  lineLengthValidation: string;
  synchronizationRules: string[];
}

export interface PlatformScriptRules {
  platform: ScriptPlanningPlatform;
  maxWordsPerScene: number;
  hookWordLimit: number;
  ctaPlacementRule: string;
  pacingGuidance: string;
}

export interface ScriptPlanningScores {
  scriptPlanningScore: number;
  storytellingScore: number;
  marketingScore: number;
  readabilityScore: number;
  brandConsistencyScore: number;
  aiConfidenceScore: number;
}

export interface ScriptPlanningRelationships {
  storyboards: string[];
  creativeDirections: string[];
  marketingStrategies: string[];
  products: string[];
  brands: string[];
  languages: string[];
  audioPlans: string[];
  productionPlans: string[];
  knowledgeRecords: string[];
}

export interface ScriptPlanningInput {
  productId: string;
  scriptPlanId?: string;
  storyboardId?: string;
  projectId?: string;
  language?: string;
}

export interface ScriptPlanningRecord {
  scriptPlanId: string;
  productId: string;
  projectId: string;
  storyboardId: string;
  creativeId: string;
  strategyId: string;
  profile: ScriptPlanningProfile;
  scenePlans: SceneScriptPlan[];
  scriptStructure: ScriptStructure;
  voicePreparation: VoicePreparation;
  subtitlePreparation: SubtitlePreparation;
  platformRules: PlatformScriptRules;
  scores: ScriptPlanningScores;
  relationships: ScriptPlanningRelationships;
  validated: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
  version: number;
}

export interface ScriptPlanningResult {
  success: boolean;
  record?: ScriptPlanningRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ScriptPlanningSearchQuery {
  scriptPlanId?: string;
  storyboardId?: string;
  brand?: string;
  productId?: string;
  campaignGoal?: MarketingObjective;
  platform?: ScriptPlanningPlatform;
  language?: string;
  audience?: string;
  text?: string;
  limit?: number;
}

export interface ScriptPlanningEngineStatusReport {
  engineStatus: string;
  scriptPlanningStatus: string;
  narrationPlanningStatus: string;
  subtitlePlanningStatus: string;
  scriptPlansPrepared: number;
  averageScriptPlanningScore: number;
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

export class ScriptPlanningEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ScriptPlanningEngineError";
  }
}
