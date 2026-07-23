/**
 * KWIZERA AI STUDIO — Target Audience Intelligence Engine types (Step 5D)
 */

import type { ProductUnderstandingMarketingGoal } from "../product-understanding-engine/types.js";

export enum AudiencePlatform {
  TikTok = "tiktok",
  Instagram = "instagram",
  Facebook = "facebook",
  YouTube = "youtube",
  WhatsApp = "whatsapp",
  Website = "website",
  Future = "future-platforms",
}

export enum AudienceCategory {
  B2BProfessional = "b2b-professional",
  B2CConsumer = "b2c-consumer",
  D2CDirect = "d2c-direct",
  Enterprise = "enterprise",
  Marketplace = "marketplace",
  Subscription = "subscription",
  General = "general",
}

export interface AudienceDemographics {
  ageGroup?: string;
  region?: string;
  language?: string;
  businessType: string;
  customerType: string;
}

export interface PsychologicalUnderstanding {
  customerNeeds: string[];
  customerGoals: string[];
  customerInterests: string[];
  customerChallenges: string[];
  customerMotivation: string[];
  buyingIntent: string;
  decisionFactors: string[];
}

export interface AudienceSegmentation {
  productType: string;
  industry: string;
  customerNeeds: string[];
  businessGoals: string[];
  marketingObjectives: string[];
  communicationPreferences: string[];
}

export interface AudienceMarketingPreparation {
  marketingStrategyReady: boolean;
  creativeDirectionReady: boolean;
  storyboardReady: boolean;
  scriptPlanningReady: boolean;
  visualPlanningReady: boolean;
  productionPlanningReady: boolean;
}

export interface AudienceProfile {
  audienceId: string;
  audienceName: string;
  audienceCategory: AudienceCategory;
  industry: string;
  productCategory: string;
  preferredLanguage?: string;
  preferredCommunicationStyle: string;
  preferredPlatforms: AudiencePlatform[];
  marketingGoal: ProductUnderstandingMarketingGoal;
}

export interface AudienceScores {
  audienceRelevanceScore: number;
  audienceConfidenceScore: number;
  marketingReadinessScore: number;
  communicationReadinessScore: number;
  relationshipScore: number;
}

export interface AudienceRelationships {
  products: string[];
  brands: string[];
  campaigns: string[];
  creativeStyles: string[];
  languages: string[];
  industries: string[];
  customerSegments: string[];
  knowledgeRecords: string[];
}

export interface AudienceIntelligenceInput {
  productId: string;
  audienceId?: string;
  audienceName?: string;
  preferredLanguage?: string;
  preferredPlatforms?: AudiencePlatform[];
  marketingGoal?: ProductUnderstandingMarketingGoal;
  demographics?: {
    ageGroup?: string;
    region?: string;
    language?: string;
  };
  campaignId?: string;
}

export interface AudienceIntelligenceRecord {
  audienceId: string;
  productId: string;
  understandingId: string;
  analysisId: string;
  profile: AudienceProfile;
  demographics: AudienceDemographics;
  psychological: PsychologicalUnderstanding;
  segmentation: AudienceSegmentation;
  marketingPreparation: AudienceMarketingPreparation;
  scores: AudienceScores;
  relationships: AudienceRelationships;
  validated: boolean;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface AudienceIntelligenceResult {
  success: boolean;
  record?: AudienceIntelligenceRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface AudienceSearchQuery {
  audienceType?: AudienceCategory;
  industry?: string;
  productId?: string;
  language?: string;
  platform?: AudiencePlatform;
  businessGoal?: string;
  customerNeed?: string;
  marketingGoal?: ProductUnderstandingMarketingGoal;
  text?: string;
  limit?: number;
}

export interface AudienceIntelligenceEngineStatusReport {
  engineStatus: string;
  audienceAnalysisStatus: string;
  segmentationStatus: string;
  relationshipStatus: string;
  audiencesAnalyzed: number;
  averageRelevanceScore: number;
  averageConfidenceScore: number;
  performance: {
    averageAnalysisMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class AudienceIntelligenceEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "AudienceIntelligenceEngineError";
  }
}
