/**
 * KWIZERA AI STUDIO — Composition Intelligence Engine types (Step 6F)
 */

export enum CompositionType {
  RuleOfThirds = "rule-of-thirds",
  Center = "center",
  Symmetry = "symmetry",
  Asymmetry = "asymmetry",
  Dynamic = "dynamic",
  Minimal = "minimal",
  Layered = "layered",
}

export enum CompositionMarketingGoal {
  Conversion = "conversion",
  Awareness = "awareness",
  Engagement = "engagement",
  Retention = "retention",
  Launch = "launch",
  Education = "education",
}

export enum CompositionPlatform {
  Web = "web",
  Social = "social",
  Ecommerce = "ecommerce",
  Print = "print",
  Mobile = "mobile",
  MultiPlatform = "multi-platform",
}

export interface CompositionAnalysis {
  compositionType: CompositionType;
  ruleOfThirds: boolean;
  centerComposition: boolean;
  symmetry: number;
  asymmetry: number;
  balance: number;
  negativeSpace: number;
  positiveSpace: number;
  leadingLines: string;
  depth: string;
  perspective: string;
  framing: string;
  cropping: string;
  spacing: string;
}

export interface VisualHierarchy {
  mainSubjectVisibility: number;
  secondarySubjectVisibility: number;
  productPriority: number;
  brandVisibility: number;
  ctaVisibility: number;
  readingFlow: string;
}

export interface ProductPlacement {
  productPosition: string;
  productScale: string;
  productAlignment: string;
  productVisibility: number;
  productFocus: string;
  productEmphasis: string;
}

export interface CompositionSuitability {
  advertisement: number;
  poster: number;
  socialMedia: number;
  productShowcase: number;
  banner: number;
  thumbnail: number;
  videoProduction: number;
}

export interface CompositionImprovementPlan {
  cropStrategy: string;
  repositionStrategy: string;
  balanceStrategy: string;
  focusStrategy: string;
  framingStrategy: string;
  visualHierarchyStrategy: string;
}

export interface CompositionIntelligenceScores {
  compositionQualityScore: number;
  visualBalanceScore: number;
  visualHierarchyScore: number;
  marketingReadinessScore: number;
  creativeReadinessScore: number;
  aiConfidenceScore: number;
}

export interface CompositionIntelligenceRelationships {
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCreativeStyles: string[];
  relatedBackgrounds: string[];
  relatedStoryboards: string[];
  relatedMarketingCampaigns: string[];
  relatedKnowledge: string[];
  relatedImages: string[];
  relatedProjects: string[];
}

export interface CompositionIntelligenceRecommendation {
  category: "balance" | "hierarchy" | "placement" | "framing" | "marketing" | "creative";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface CompositionIntelligenceInput {
  imageId: string;
  industry?: string;
  marketingGoal?: CompositionMarketingGoal;
  platform?: CompositionPlatform;
  relatedProjects?: string[];
  relatedKnowledge?: string[];
  keywords?: string[];
}

export interface CompositionIntelligenceRecord {
  imageId: string;
  compositionId: string;
  analysisId: string;
  understandingId: string;
  detectionId: string;
  backgroundId?: string;
  compositionAnalysis: CompositionAnalysis;
  visualHierarchy: VisualHierarchy;
  productPlacement: ProductPlacement;
  suitability: CompositionSuitability;
  improvementPlan: CompositionImprovementPlan;
  scores: CompositionIntelligenceScores;
  relationships: CompositionIntelligenceRelationships;
  recommendations: CompositionIntelligenceRecommendation[];
  keywords: string[];
  validated: boolean;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface CompositionIntelligenceResult {
  success: boolean;
  record?: CompositionIntelligenceRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface CompositionIntelligenceSearchQuery {
  compositionType?: CompositionType;
  brand?: string;
  product?: string;
  creativeStyle?: string;
  industry?: string;
  marketingGoal?: CompositionMarketingGoal;
  platform?: CompositionPlatform;
  imageId?: string;
  keywords?: string[];
  limit?: number;
}

export interface CompositionIntelligenceEngineStatusReport {
  engineStatus: string;
  compositionAnalysisStatus: string;
  visualHierarchyStatus: string;
  productPlacementStatus: string;
  improvementPlanningStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
  imagesAnalyzed: number;
  averageQualityScore: number;
  averageHierarchyScore: number;
  performance: {
    averageAnalysisMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class CompositionIntelligenceEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "CompositionIntelligenceEngineError";
  }
}
