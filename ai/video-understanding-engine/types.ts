/**
 * KWIZERA AI STUDIO — Video Understanding Engine types (Step 7C)
 */

export enum VideoUnderstandingMarketingGoal {
  Conversion = "conversion",
  Awareness = "awareness",
  Engagement = "engagement",
  Retention = "retention",
  Launch = "launch",
  Education = "education",
}

export enum VideoStoryType {
  ProblemSolution = "problem-solution",
  ProductDemo = "product-demo",
  BrandStory = "brand-story",
  Tutorial = "tutorial",
  Testimonial = "testimonial",
  Lifestyle = "lifestyle",
  Promotional = "promotional",
  Documentary = "documentary",
  Interview = "interview",
  Other = "other",
}

export enum VideoSceneRole {
  Opening = "opening",
  Hook = "hook",
  MainContent = "main-content",
  ProductDemonstration = "product-demonstration",
  Promotional = "promotional",
  Cta = "cta",
  Ending = "ending",
}

export interface VideoIdentity {
  videoId: string;
  videoName: string;
  videoType: string;
  analysisId: string;
  visualSummary: string;
}

export interface VideoPurpose {
  primaryPurpose: string;
  intendedUse: string;
  creativeIntent: string;
  whyThisVideoExists: string;
}

export interface VideoContextUnderstanding {
  videoContext: string;
  marketingContext: string;
  creativeContext: string;
  productionContext: string;
  brandContext: string;
}

export interface VideoSceneUnderstanding {
  sceneId: string;
  role: VideoSceneRole;
  label: string;
  startMs: number;
  endMs: number;
  description: string;
  importance: "primary" | "secondary" | "supporting";
}

export interface SceneRelationshipMap {
  sceneId: string;
  relatedSceneIds: string[];
  relationshipType: string;
}

export interface StoryUnderstanding {
  storyType: VideoStoryType;
  storyFlow: string;
  narrativeStructure: string;
  emotionalJourney: string;
  informationFlow: string;
  viewerAttentionFlow: string;
  marketingJourney: string;
}

export interface ProductUnderstanding {
  mainProduct: string;
  secondaryProducts: string[];
  productImportance: string;
  productVisibility: number;
  productPresentation: string;
  productUsage: string;
}

export interface BrandUnderstanding {
  brandIdentity: string;
  logoPresence: boolean;
  brandVisibility: number;
  brandMessaging: string;
  brandConsistency: number;
}

export interface AudienceUnderstanding {
  targetAudience: string;
  viewerInterest: string;
  engagementOpportunity: string;
  viewerRetentionOpportunity: string;
  conversionOpportunity: string;
}

export interface MarketingUnderstanding {
  campaignGoal: string;
  offerPresentation: string;
  productBenefits: string;
  ctaOpportunity: string;
  marketingStrength: number;
}

export interface VideoChapter {
  chapterId: string;
  title: string;
  startMs: number;
  endMs: number;
  sectionIds: string[];
}

export interface VideoSection {
  sectionId: string;
  title: string;
  startMs: number;
  endMs: number;
  sceneIds: string[];
}

export interface VideoStructureHierarchy {
  chapters: VideoChapter[];
  sections: VideoSection[];
  sceneHierarchy: string[];
  timelineHierarchy: string[];
  storyHierarchy: string[];
}

export interface KnowledgeGraphNode {
  nodeId: string;
  nodeType: "scene" | "product" | "brand" | "story" | "timeline" | "campaign";
  label: string;
  metadata: Record<string, string>;
}

export interface KnowledgeGraphEdge {
  edgeId: string;
  sourceId: string;
  targetId: string;
  relationship: string;
}

export interface VideoUnderstandingKnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface VideoUnderstandingScores {
  videoUnderstandingScore: number;
  storytellingScore: number;
  marketingScore: number;
  audienceAlignmentScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface VideoUnderstandingRecommendation {
  category: "story" | "scene" | "product" | "brand" | "marketing" | "audience" | "production";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface VideoUnderstandingRelationships {
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCampaigns: string[];
  relatedImages: string[];
  relatedStoryboards: string[];
  relatedScripts: string[];
  relatedCreativePlans: string[];
  relatedKnowledge: string[];
  relatedVideos: string[];
  relatedMemory: string[];
  relatedProjects: string[];
}

export interface VideoUnderstandingInput {
  videoId: string;
  marketingGoal?: VideoUnderstandingMarketingGoal;
  storyType?: VideoStoryType;
  industry?: string;
  relatedProjects?: string[];
  relatedKnowledge?: string[];
  relatedStoryboards?: string[];
  relatedScripts?: string[];
  relatedCreativePlans?: string[];
}

export interface VideoUnderstandingRecord {
  videoId: string;
  understandingId: string;
  analysisId: string;
  identity: VideoIdentity;
  purpose: VideoPurpose;
  context: VideoContextUnderstanding;
  scenes: VideoSceneUnderstanding[];
  sceneRelationships: SceneRelationshipMap[];
  story: StoryUnderstanding;
  product: ProductUnderstanding;
  brand: BrandUnderstanding;
  audience: AudienceUnderstanding;
  marketing: MarketingUnderstanding;
  structure: VideoStructureHierarchy;
  knowledgeGraph: VideoUnderstandingKnowledgeGraph;
  scores: VideoUnderstandingScores;
  relationships: VideoUnderstandingRelationships;
  recommendations: VideoUnderstandingRecommendation[];
  marketingGoal: VideoUnderstandingMarketingGoal;
  storyType: VideoStoryType;
  industry: string;
  keywords: string[];
  validated: boolean;
  understoodAt: string;
  lastUpdated: string;
  version: number;
}

export interface VideoUnderstandingResult {
  success: boolean;
  record?: VideoUnderstandingRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface VideoUnderstandingSearchQuery {
  videoPurpose?: string;
  storyType?: VideoStoryType;
  product?: string;
  brand?: string;
  campaign?: string;
  audience?: string;
  marketingGoal?: VideoUnderstandingMarketingGoal;
  keywords?: string[];
  text?: string;
  limit?: number;
}

export interface VideoUnderstandingEngineStatusReport {
  engineStatus: string;
  sceneUnderstandingStatus: string;
  storyUnderstandingStatus: string;
  productUnderstandingStatus: string;
  brandUnderstandingStatus: string;
  marketingUnderstandingStatus: string;
  audienceUnderstandingStatus: string;
  knowledgeGraphStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
  imageIntelligenceBridgeStatus: string;
  videosUnderstood: number;
  averageUnderstandingScore: number;
  averageMarketingScore: number;
  performance: {
    averageUnderstandingMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
    averageGraphBuildMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class VideoUnderstandingEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "VideoUnderstandingEngineError";
  }
}
