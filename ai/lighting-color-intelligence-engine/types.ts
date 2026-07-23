/**
 * KWIZERA AI STUDIO — Lighting & Color Intelligence Engine types (Step 6G)
 */

export enum LightingType {
  Studio = "studio",
  Natural = "natural",
  Artificial = "artificial",
  Mixed = "mixed",
  Backlit = "backlit",
  SideLit = "side-lit",
  TopLit = "top-lit",
  LowKey = "low-key",
  HighKey = "high-key",
}

export enum LightingDirection {
  Front = "front",
  Side = "side",
  Back = "back",
  Top = "top",
  Diffused = "diffused",
  Mixed = "mixed",
}

export enum ColorTemperature {
  Warm = "warm",
  Neutral = "neutral",
  Cool = "cool",
}

export enum LightingColorMarketingGoal {
  Conversion = "conversion",
  Awareness = "awareness",
  Engagement = "engagement",
  Retention = "retention",
  Launch = "launch",
  Education = "education",
}

export interface LightingAnalysis {
  lightingType: LightingType;
  lightingDirection: LightingDirection;
  lightingIntensity: number;
  lightingUniformity: number;
  exposure: number;
  overexposure: number;
  underexposure: number;
  shadows: number;
  highlights: number;
  reflections: number;
}

export interface ColorAnalysis {
  dominantColors: string[];
  colorPalette: string[];
  colorHarmony: number;
  colorContrast: number;
  saturation: number;
  vibrance: number;
  hueDistribution: string;
  whiteBalance: number;
  colorTemperature: ColorTemperature;
  brandColorMatching: number;
}

export interface LightingSuitability {
  productPhotography: number;
  advertisement: number;
  poster: number;
  socialMedia: number;
  thumbnail: number;
  videoProduction: number;
}

export interface ColorSuitability {
  brandCompatibility: number;
  marketingEffectiveness: number;
  emotionalImpact: number;
  visualComfort: number;
  readability: number;
  creativeConsistency: number;
}

export interface LightingImprovementPlan {
  exposureStrategy: string;
  shadowStrategy: string;
  highlightStrategy: string;
  reflectionStrategy: string;
  whiteBalanceStrategy: string;
  lightingConsistencyStrategy: string;
}

export interface ColorImprovementPlan {
  colorHarmonyStrategy: string;
  colorBalanceStrategy: string;
  contrastStrategy: string;
  saturationStrategy: string;
  brandColorStrategy: string;
  colorGradingPreparation: string;
}

export interface LightingColorIntelligenceScores {
  lightingQualityScore: number;
  colorQualityScore: number;
  brandColorScore: number;
  marketingReadinessScore: number;
  creativeReadinessScore: number;
  aiConfidenceScore: number;
}

export interface LightingColorIntelligenceRelationships {
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCreativeStyles: string[];
  relatedBackgrounds: string[];
  relatedCompositionPlans: string[];
  relatedStoryboards: string[];
  relatedMarketingCampaigns: string[];
  relatedKnowledge: string[];
  relatedImages: string[];
  relatedProjects: string[];
}

export interface LightingColorIntelligenceRecommendation {
  category: "lighting" | "color" | "brand" | "marketing" | "creative";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface LightingColorIntelligenceInput {
  imageId: string;
  industry?: string;
  marketingGoal?: LightingColorMarketingGoal;
  relatedProjects?: string[];
  relatedKnowledge?: string[];
  keywords?: string[];
}

export interface LightingColorIntelligenceRecord {
  imageId: string;
  lightingColorId: string;
  analysisId: string;
  understandingId: string;
  compositionId?: string;
  backgroundId?: string;
  lighting: LightingAnalysis;
  color: ColorAnalysis;
  lightingSuitability: LightingSuitability;
  colorSuitability: ColorSuitability;
  lightingPlan: LightingImprovementPlan;
  colorPlan: ColorImprovementPlan;
  scores: LightingColorIntelligenceScores;
  relationships: LightingColorIntelligenceRelationships;
  recommendations: LightingColorIntelligenceRecommendation[];
  keywords: string[];
  validated: boolean;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface LightingColorIntelligenceResult {
  success: boolean;
  record?: LightingColorIntelligenceRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface LightingColorIntelligenceSearchQuery {
  lightingType?: LightingType;
  colorPalette?: string;
  brand?: string;
  product?: string;
  creativeStyle?: string;
  industry?: string;
  marketingGoal?: LightingColorMarketingGoal;
  imageId?: string;
  keywords?: string[];
  limit?: number;
}

export interface LightingColorIntelligenceEngineStatusReport {
  engineStatus: string;
  lightingAnalysisStatus: string;
  colorAnalysisStatus: string;
  brandColorStatus: string;
  improvementPlanningStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
  imagesAnalyzed: number;
  averageLightingScore: number;
  averageColorScore: number;
  performance: {
    averageAnalysisMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class LightingColorIntelligenceEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "LightingColorIntelligenceEngineError";
  }
}
