/**
 * KWIZERA AI STUDIO — Brand Visual Intelligence Engine types (Step 6H)
 */

export enum BrandVisualStyle {
  Luxury = "luxury",
  Modern = "modern",
  Minimal = "minimal",
  Corporate = "corporate",
  Technology = "technology",
  Fashion = "fashion",
  Beauty = "beauty",
  Food = "food",
  RealEstate = "real-estate",
  Education = "education",
  Healthcare = "healthcare",
}

export interface BrandTypography {
  primaryFont: string;
  secondaryFont: string;
  fontHierarchy: string;
  headingStyle: string;
  bodyStyle: string;
  ctaStyle: string;
}

export interface BrandVisualProfile {
  brandId: string;
  brandName: string;
  brandCategory: string;
  industry: string;
  logo: string;
  primaryColors: string[];
  secondaryColors: string[];
  typography: BrandTypography;
  iconStyle: string;
  graphicStyle: string;
  visualTheme: string;
  brandVersion: string;
}

export interface LogoAnalysis {
  logoVisibility: number;
  logoPosition: string;
  logoSize: string;
  logoContrast: number;
  logoSafeArea: string;
  logoPriority: string;
  logoConsistency: number;
}

export interface BrandColorAnalysis {
  primaryBrandColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  backgroundColors: string[];
  textColors: string[];
  ctaColors: string[];
  colorHarmony: number;
}

export interface BrandVisualConsistencyCheck {
  logoConsistency: number;
  colorConsistency: number;
  typographyConsistency: number;
  layoutConsistency: number;
  visualIdentity: number;
  marketingConsistency: number;
}

export interface BrandVisualPlanning {
  logoPlacementPlan: string;
  colorApplicationPlan: string;
  typographyPlan: string;
  visualStylePlan: string;
  brandGuidelineNotes: string;
  consistencyProtectionPlan: string;
}

export interface BrandVisualIntelligenceScores {
  brandConsistencyScore: number;
  logoQualityScore: number;
  colorConsistencyScore: number;
  typographyScore: number;
  marketingReadinessScore: number;
  aiConfidenceScore: number;
}

export interface BrandVisualIntelligenceRelationships {
  relatedProducts: string[];
  relatedImages: string[];
  relatedCampaigns: string[];
  relatedCreativeStyles: string[];
  relatedStoryboards: string[];
  relatedVisualPlans: string[];
  relatedMarketingStrategies: string[];
  relatedKnowledge: string[];
  relatedProjects: string[];
}

export interface BrandVisualIntelligenceRecommendation {
  category: "logo" | "color" | "typography" | "consistency" | "marketing" | "creative";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface BrandVisualIntelligenceInput {
  imageId: string;
  brandName?: string;
  industry?: string;
  visualStyle?: BrandVisualStyle;
  relatedProjects?: string[];
  relatedKnowledge?: string[];
  keywords?: string[];
}

export interface BrandVisualIntelligenceRecord {
  imageId: string;
  brandVisualId: string;
  analysisId: string;
  understandingId: string;
  detectionId: string;
  lightingColorId?: string;
  profile: BrandVisualProfile;
  logoAnalysis: LogoAnalysis;
  colorAnalysis: BrandColorAnalysis;
  typography: BrandTypography;
  visualStyle: BrandVisualStyle;
  consistency: BrandVisualConsistencyCheck;
  planning: BrandVisualPlanning;
  scores: BrandVisualIntelligenceScores;
  relationships: BrandVisualIntelligenceRelationships;
  recommendations: BrandVisualIntelligenceRecommendation[];
  keywords: string[];
  validated: boolean;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface BrandVisualIntelligenceResult {
  success: boolean;
  record?: BrandVisualIntelligenceRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface BrandVisualIntelligenceSearchQuery {
  brand?: string;
  industry?: string;
  visualStyle?: BrandVisualStyle;
  logo?: string;
  color?: string;
  typography?: string;
  campaign?: string;
  imageId?: string;
  keywords?: string[];
  limit?: number;
}

export interface BrandVisualIntelligenceEngineStatusReport {
  engineStatus: string;
  brandAnalysisStatus: string;
  logoValidationStatus: string;
  colorValidationStatus: string;
  typographyStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
  brandsAnalyzed: number;
  averageConsistencyScore: number;
  averageLogoScore: number;
  performance: {
    averageAnalysisMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class BrandVisualIntelligenceEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "BrandVisualIntelligenceEngineError";
  }
}
