/**
 * KWIZERA AI STUDIO — Marketing Memory Engine types (Step 3H)
 */
export declare enum MarketingPlatform {
    TikTok = "tiktok",
    InstagramReels = "instagram-reels",
    Facebook = "facebook",
    YouTubeShorts = "youtube-shorts",
    YouTubeLong = "youtube-long",
    WhatsAppStatus = "whatsapp-status",
    Website = "website",
    Email = "email",
    Other = "other"
}
export declare enum CampaignType {
    ProductLaunch = "product-launch",
    BrandAwareness = "brand-awareness",
    Conversion = "conversion",
    Engagement = "engagement",
    Retargeting = "retargeting",
    Seasonal = "seasonal",
    General = "general"
}
export declare enum CampaignStatus {
    Draft = "draft",
    Active = "active",
    Paused = "paused",
    Completed = "completed",
    Archived = "archived"
}
export interface ContentMemory {
    headlines: string[];
    hooks: string[];
    captions: string[];
    callToActions: string[];
    productDescriptions: string[];
    promotionalScripts: string[];
    hashtags: string[];
    keywords: string[];
    sellingPoints: string[];
    emotionalTriggers: string[];
}
export interface CampaignStructureMemory {
    campaignStructure: string;
    campaignFlow: string;
    openingStyle: string;
    productPresentation: string;
    benefits: string[];
    customerProblem: string;
    solution: string;
    closingStrategy: string;
    offerStrategy: string;
}
export interface SocialMediaMemory {
    platform: MarketingPlatform;
    bestPractices: string[];
    contentStyle: string;
    optimalLength: string;
    postingTips: string[];
}
export interface BrandingMemory {
    brandVoice: string;
    brandPersonality: string;
    brandColors: string[];
    brandIdentity: string;
    brandStyle: string;
    brandMessaging: string;
    logoUsage: string;
    typography: string;
}
export interface CustomerMemoryProfile {
    customerInterests: string[];
    customerBehaviour: string[];
    customerPreferences: string[];
    productCategories: string[];
    preferredMarketingStyles: string[];
    preferredVideoStyles: string[];
    preferredLanguages: string[];
}
export interface MarketingQualityScores {
    qualityScore: number;
    effectivenessScore: number;
    engagementScore: number;
    conversionScore: number;
    learningScore: number;
    aiConfidenceScore: number;
}
export interface MarketingPattern {
    patternId: string;
    patternType: "campaign-structure" | "headline" | "hook" | "cta" | "storytelling" | "product-positioning";
    description: string;
    sourceCampaignId: string;
    confidence: number;
    reusable: boolean;
    detectedAt: string;
}
export interface MarketingVersionInfo {
    version: number;
    timestamp: string;
    changeSummary: string;
    memoryVersion: number;
}
export interface MarketingCreateInput {
    campaignId?: string;
    projectId: string;
    campaignName: string;
    product?: string;
    brand?: string;
    campaignType?: CampaignType;
    platform?: MarketingPlatform;
    targetAudience?: string;
    goal?: string;
    language?: string;
    campaignDate?: string;
    content?: Partial<ContentMemory>;
    campaign?: Partial<CampaignStructureMemory>;
    branding?: Partial<BrandingMemory>;
    socialMedia?: Partial<SocialMediaMemory>;
    customer?: Partial<CustomerMemoryProfile>;
    tags?: string[];
    keywords?: string[];
}
export interface MarketingUpdateInput {
    campaignName?: string;
    status?: CampaignStatus;
    product?: string;
    brand?: string;
    campaignType?: CampaignType;
    platform?: MarketingPlatform;
    targetAudience?: string;
    goal?: string;
    language?: string;
    content?: Partial<ContentMemory>;
    contentAppend?: Partial<ContentMemory>;
    campaign?: Partial<CampaignStructureMemory>;
    branding?: Partial<BrandingMemory>;
    socialMedia?: Partial<SocialMediaMemory>;
    customer?: Partial<CustomerMemoryProfile>;
    effectivenessRating?: number;
    lessonsLearned?: string[];
    strengths?: string[];
    weaknesses?: string[];
    tags?: string[];
    keywords?: string[];
}
export interface MarketingRecord {
    campaignId: string;
    memoryId: string;
    projectId: string;
    campaignName: string;
    product: string;
    brand: string;
    campaignType: CampaignType;
    platform: MarketingPlatform;
    targetAudience: string;
    goal: string;
    language: string;
    campaignDate: string;
    status: CampaignStatus;
    creationDate: string;
    lastModified: string;
    content: ContentMemory;
    campaign: CampaignStructureMemory;
    branding: BrandingMemory;
    socialMedia: SocialMediaMemory;
    customer: CustomerMemoryProfile;
    scores: MarketingQualityScores;
    patterns: MarketingPattern[];
    relatedMemories: string[];
    lessonsLearned: string[];
    strengths: string[];
    weaknesses: string[];
    versions: MarketingVersionInfo[];
    tags: string[];
    keywords: string[];
}
export interface MarketingProcessResult {
    success: boolean;
    campaignId: string;
    memoryId: string;
    version: number;
    durationMs: number;
    patternsDetected: number;
    reason?: string;
}
export interface MarketingLearningResult {
    success: boolean;
    campaignId: string;
    patternsStored: number;
    learningId?: string;
    recommendations: string[];
    strengths: string[];
    weaknesses: string[];
}
export interface MarketingRelationships {
    relatedCampaigns: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedVideos: string[];
    relatedStyles: string[];
    relatedCustomerTypes: string[];
    relatedMemories: string[];
}
export interface MarketingMemoryStatusReport {
    engineStatus: string;
    campaignStatus: string;
    patternDetectionStatus: string;
    brandMemoryStatus: string;
    relationshipStatus: string;
    totalCampaigns: number;
    totalPatterns: number;
    totalCustomerProfiles: number;
    performance: {
        averageSaveMs: number;
        averageLoadMs: number;
        averageSearchMs: number;
        totalVersions: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MarketingMemoryEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map