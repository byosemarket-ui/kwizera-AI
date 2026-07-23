/**
 * KWIZERA AI STUDIO — Brand Knowledge Engine types (Step 4I)
 */

export enum KnowledgeBrandIndustry {
  Technology = "technology",
  Creative = "creative",
  Fashion = "fashion",
  Beauty = "beauty",
  Food = "food",
  Hospitality = "hospitality",
  Education = "education",
  Health = "health",
  Automotive = "automotive",
  RealEstate = "real-estate",
  General = "general",
  Future = "future",
}

export enum BrandMarketingStyle {
  Premium = "premium",
  Playful = "playful",
  Professional = "professional",
  Emotional = "emotional",
  Minimal = "minimal",
  Bold = "bold",
}

export interface BrandIdentityProfile {
  brandId: string;
  brandName: string;
  brandDescription: string;
  industry: KnowledgeBrandIndustry;
  brandMission: string;
  brandVision: string;
  brandValues: string[];
  brandPersonality: string;
  brandTone: string;
  brandTargetAudience: string;
  brandPositioning: string;
}

export interface VisualBrandKnowledge {
  logo: string;
  logoVariations: string[];
  logoUsageRules: string[];
  brandColors: string[];
  typography: string;
  icons: string[];
  designLanguage: string;
  visualIdentity: string;
  layoutStyle: string;
  backgroundStyle: string;
  motionStyle: string;
  introStyle: string;
  outroStyle: string;
}

export interface BrandCommunicationKnowledge {
  brandVoice: string;
  writingStyle: string;
  messagingStyle: string;
  storytellingStyle: string;
  marketingTone: string;
  customerCommunication: string;
  callToActionStyle: string;
  emotionalStyle: string;
}

export interface BrandConsistencyCheck {
  logoUsage: number;
  colorUsage: number;
  typography: number;
  voiceConsistency: number;
  messagingConsistency: number;
  visualConsistency: number;
  marketingConsistency: number;
  animationConsistency: number;
  overallConsistency: number;
  inconsistencies: string[];
}

export interface BrandKnowledgeQualityScores {
  brandConsistencyScore: number;
  visualIdentityScore: number;
  communicationScore: number;
  marketingScore: number;
  recognitionScore: number;
  aiConfidenceScore: number;
}

export interface BrandKnowledgeRelationships {
  relatedProducts: string[];
  relatedCampaigns: string[];
  relatedVideos: string[];
  relatedImages: string[];
  relatedMarketingStrategies: string[];
  relatedCreativeStyles: string[];
  relatedCustomerSegments: string[];
  relatedProjects: string[];
}

export interface BrandKnowledgeRecommendation {
  category:
    | "branding"
    | "logo-placement"
    | "color-usage"
    | "typography"
    | "storytelling"
    | "marketing-alignment"
    | "consistency";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface BrandAnalysisInput {
  brandId?: string;
  profile?: Partial<BrandIdentityProfile>;
  brandName?: string;
  brandDescription?: string;
  industry?: KnowledgeBrandIndustry;
  brandMission?: string;
  brandVision?: string;
  brandValues?: string[];
  brandPersonality?: string;
  brandTone?: string;
  brandTargetAudience?: string;
  brandPositioning?: string;
  visual?: Partial<VisualBrandKnowledge>;
  communication?: Partial<BrandCommunicationKnowledge>;
  marketingStyle?: BrandMarketingStyle;
  history?: string[];
  language?: string;
  tags?: string[];
  keywords?: string[];
  relatedKnowledge?: string[];
  relatedMemory?: string[];
}

export interface BrandAnalysisRecord {
  brandId: string;
  knowledgeId: string;
  profile: BrandIdentityProfile;
  visual: VisualBrandKnowledge;
  communication: BrandCommunicationKnowledge;
  marketingStyle: BrandMarketingStyle;
  history: string[];
  consistency: BrandConsistencyCheck;
  scores: BrandKnowledgeQualityScores;
  relationships: BrandKnowledgeRelationships;
  recommendations: BrandKnowledgeRecommendation[];
  tags: string[];
  keywords: string[];
  language: string;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface BrandAnalysisResult {
  success: boolean;
  record?: BrandAnalysisRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface BrandSearchQuery {
  brandName?: string;
  industry?: KnowledgeBrandIndustry;
  category?: string;
  colors?: string[];
  typography?: string;
  logo?: string;
  marketingStyle?: BrandMarketingStyle;
  audience?: string;
  products?: string;
  language?: string;
  text?: string;
  minConsistency?: number;
  limit?: number;
}

export interface BrandKnowledgeLearningPattern {
  patternId: string;
  patternType:
    | "identity"
    | "visual"
    | "communication"
    | "consistency"
    | "campaign"
    | "presentation";
  description: string;
  sourceBrandId: string;
  confidence: number;
  detectedAt: string;
}

export interface BrandKnowledgeStatusReport {
  engineStatus: string;
  brandConsistencyStatus: string;
  visualIdentityStatus: string;
  recommendationQuality: string;
  relationshipStatus: string;
  brandsAnalyzed: number;
  patternsLearned: number;
  averageBrandConsistencyScore: number;
  performance: {
    averageAnalysisMs: number;
    averageSearchMs: number;
    averageRecommendationMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class BrandKnowledgeEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "BrandKnowledgeEngineError";
  }
}
