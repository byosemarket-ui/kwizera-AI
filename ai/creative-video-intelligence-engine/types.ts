/**
 * KWIZERA AI STUDIO — Creative Video Intelligence Engine types (Step 7J)
 */

export enum CreativeVideoPlatform {
  TikTok = "tiktok",
  InstagramReels = "instagram-reels",
  Facebook = "facebook",
  YouTube = "youtube",
  WhatsApp = "whatsapp",
  Website = "website",
  Television = "television",
}

export enum CreativeVideoTemplateType {
  ProductAdvertisement = "product-advertisement",
  BrandAdvertisement = "brand-advertisement",
  LaunchCampaign = "launch-campaign",
  Restaurant = "restaurant",
  Fashion = "fashion",
  Beauty = "beauty",
  Electronics = "electronics",
  Education = "education",
  Healthcare = "healthcare",
  RealEstate = "real-estate",
}

export enum CreativeVideoType {
  Commercial = "commercial",
  Social = "social",
  Educational = "educational",
  Promotional = "promotional",
  BrandStory = "brand-story",
  ProductDemo = "product-demo",
}

export interface CreativeVideoProfile {
  creativeVideoId: string;
  projectId: string;
  videoId: string;
  product: string;
  brand: string;
  campaign: string;
  platform: CreativeVideoPlatform;
  creativeVersion: number;
}

export interface StoryboardPlan {
  storyStructure: string;
  openingHook: string;
  sceneOrder: string[];
  sceneTiming: { sceneId: string; startMs: number; endMs: number; label: string }[];
  productReveal: { sceneId: string; timingMs: number; strategy: string };
  brandReveal: { sceneId: string; timingMs: number; strategy: string };
  ctaPlacement: { sceneId: string; timingMs: number; strategy: string };
  endingStrategy: string;
}

export interface CreativeStructure {
  storyFlow: string;
  emotionalFlow: string;
  marketingFlow: string;
  viewerJourney: string;
  conversionJourney: string;
}

export interface CreativeVisualPlan {
  cameraStyle: string;
  motionStyle: string;
  sceneComposition: string;
  lightingStyle: string;
  colorStyle: string;
  typographyStyle: string;
  graphicStyle: string;
  transitionStyle: string;
  effectStyle: string;
}

export interface CreativeAudioPlan {
  voiceStyle: string;
  musicStyle: string;
  soundEffects: string;
  audioTiming: string;
  audioMood: string;
  audioSynchronization: string;
}

export interface CreativeMarketingPlan {
  productShowcase: string;
  offerPresentation: string;
  brandAwareness: string;
  socialEngagement: string;
  leadGeneration: string;
  ctaStrategy: string;
}

export interface CreativeVideoTemplate {
  templateId: string;
  type: CreativeVideoTemplateType;
  name: string;
  description: string;
  storyboardHints: string[];
  marketingFocus: string;
  matchScore: number;
}

export interface PlatformCreativePlan {
  platform: CreativeVideoPlatform;
  hookStrategy: string;
  pacing: string;
  formatNotes: string[];
  priority: "low" | "medium" | "high";
}

export interface ProductionInstructions {
  preProduction: string[];
  production: string[];
  postProduction: string[];
  delivery: string[];
}

export interface CreativeQualityScores {
  creativeScore: number;
  storytellingScore: number;
  marketingScore: number;
  visualImpactScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface CreativeRecommendation {
  category: "storyboard" | "visual" | "audio" | "marketing" | "platform" | "production";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface CreativeRelationships {
  relatedStoryboards: string[];
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCampaigns: string[];
  relatedMotionPlans: string[];
  relatedCameraPlans: string[];
  relatedEnhancementPlans: string[];
  relatedScripts: string[];
  relatedKnowledge: string[];
  relatedVideos: string[];
  relatedMemory: string[];
  relatedProjects: string[];
}

export interface CreativeVideoIntelligenceInput {
  videoId: string;
  projectId?: string;
  platform?: CreativeVideoPlatform;
  creativeType?: CreativeVideoType;
  relatedStoryboards?: string[];
  relatedScripts?: string[];
  relatedKnowledge?: string[];
  relatedProjects?: string[];
}

export interface CreativeVideoIntelligenceRecord {
  videoId: string;
  intelligenceId: string;
  analysisId: string;
  detectionId: string;
  enhancementPlanId?: string;
  styleIntelligenceId?: string;
  profile: CreativeVideoProfile;
  creativeType: CreativeVideoType;
  storyboard: StoryboardPlan;
  structure: CreativeStructure;
  visualPlan: CreativeVisualPlan;
  audioPlan: CreativeAudioPlan;
  marketingPlan: CreativeMarketingPlan;
  platformPlans: PlatformCreativePlan[];
  templates: CreativeVideoTemplate[];
  productionInstructions: ProductionInstructions;
  scores: CreativeQualityScores;
  relationships: CreativeRelationships;
  recommendations: CreativeRecommendation[];
  keywords: string[];
  validated: boolean;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface CreativeVideoIntelligenceResult {
  success: boolean;
  record?: CreativeVideoIntelligenceRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface CreativeVideoSearchQuery {
  videoId?: string;
  creativeType?: CreativeVideoType;
  templateType?: CreativeVideoTemplateType;
  story?: string;
  brand?: string;
  product?: string;
  campaign?: string;
  platform?: CreativeVideoPlatform;
  keywords?: string[];
  text?: string;
  limit?: number;
}

export interface CreativeVideoEngineStatusReport {
  engineStatus: string;
  storyboardPlanningStatus: string;
  creativePlanningStatus: string;
  marketingPlanningStatus: string;
  visualPlanningStatus: string;
  audioPlanningStatus: string;
  templateLibraryStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
  imageIntelligenceBridgeStatus: string;
  videosProcessed: number;
  templatesAvailable: number;
  averageCreativeScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averagePlanningMs: number;
    averageSearchMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class CreativeVideoIntelligenceEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "CreativeVideoIntelligenceEngineError";
  }
}
