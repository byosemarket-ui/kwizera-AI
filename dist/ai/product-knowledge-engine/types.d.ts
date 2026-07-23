/**
 * KWIZERA AI STUDIO — Product Knowledge Engine types (Step 4H)
 */
export declare enum KnowledgeProductCategory {
    Electronics = "electronics",
    Fashion = "fashion",
    Shoes = "shoes",
    Bags = "bags",
    Beauty = "beauty",
    Food = "food",
    Restaurant = "restaurant",
    Hotel = "hotel",
    Furniture = "furniture",
    HomeAppliances = "home-appliances",
    Vehicles = "vehicles",
    RealEstate = "real-estate",
    Education = "education",
    Health = "health",
    Future = "future"
}
export declare enum KnowledgeProductMarketingGoal {
    Conversion = "conversion",
    Awareness = "awareness",
    Engagement = "engagement",
    Retention = "retention",
    Launch = "launch"
}
export interface ProductProfileKnowledge {
    productName: string;
    category: KnowledgeProductCategory;
    subcategory: string;
    brand: string;
    description: string;
    features: string[];
    specifications: Record<string, string>;
    materials: string[];
    dimensions: string;
    colors: string[];
    sizes: string[];
    price: number;
    currency: string;
    targetAudience: string;
    marketingGoal: KnowledgeProductMarketingGoal;
    supplier?: string;
}
export interface ProductVisualKnowledge {
    productAppearance: string;
    productShape: string;
    productColor: string;
    productTexture: string;
    productPackaging: string;
    productBackground: string;
    productPlacement: string;
    productVisibility: number;
    productQuality: number;
}
export interface ProductBrandKnowledge {
    brandIdentity: string;
    brandColors: string[];
    brandStyle: string;
    brandPersonality: string;
    logoUsage: string;
    brandConsistency: number;
}
export interface ProductMarketingKnowledge {
    productBenefits: string[];
    customerProblems: string[];
    productSolutions: string[];
    uniqueSellingPoints: string[];
    emotionalAppeal: string;
    callToAction: string;
    salesStrategy: string;
    productPositioning: string;
}
export interface ProductCustomerKnowledge {
    customerNeeds: string[];
    customerInterests: string[];
    buyingMotivation: string;
    preferredPresentation: string;
    preferredMarketingStyle: string;
    preferredPlatforms: string[];
}
export interface ProductKnowledgeQualityScores {
    productQualityScore: number;
    presentationScore: number;
    marketingReadinessScore: number;
    brandConsistencyScore: number;
    customerRelevanceScore: number;
    aiConfidenceScore: number;
}
export interface ProductKnowledgeRelationships {
    relatedProducts: string[];
    relatedBrands: string[];
    relatedVideos: string[];
    relatedImages: string[];
    relatedMarketingCampaigns: string[];
    relatedProjects: string[];
    relatedCreativeStyles: string[];
    relatedCustomerSegments: string[];
}
export interface ProductKnowledgeRecommendation {
    category: "presentation" | "positioning" | "background" | "marketing" | "branding" | "cta" | "video-structure" | "creative-direction";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface ProductAnalysisInput {
    productId?: string;
    profile?: Partial<ProductProfileKnowledge>;
    productName?: string;
    category?: KnowledgeProductCategory;
    subcategory?: string;
    brand?: string;
    description?: string;
    features?: string[];
    specifications?: Record<string, string>;
    materials?: string[];
    dimensions?: string;
    colors?: string[];
    sizes?: string[];
    price?: number;
    currency?: string;
    targetAudience?: string;
    marketingGoal?: KnowledgeProductMarketingGoal;
    supplier?: string;
    visual?: Partial<ProductVisualKnowledge>;
    brandKnowledge?: Partial<ProductBrandKnowledge>;
    marketing?: Partial<ProductMarketingKnowledge>;
    customer?: Partial<ProductCustomerKnowledge>;
    tags?: string[];
    keywords?: string[];
    language?: string;
    relatedKnowledge?: string[];
    relatedMemory?: string[];
}
export interface ProductAnalysisRecord {
    productId: string;
    knowledgeId: string;
    profile: ProductProfileKnowledge;
    visual: ProductVisualKnowledge;
    brand: ProductBrandKnowledge;
    marketing: ProductMarketingKnowledge;
    customer: ProductCustomerKnowledge;
    scores: ProductKnowledgeQualityScores;
    relationships: ProductKnowledgeRelationships;
    recommendations: ProductKnowledgeRecommendation[];
    tags: string[];
    keywords: string[];
    language: string;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface ProductAnalysisResult {
    success: boolean;
    record?: ProductAnalysisRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ProductSearchQuery {
    productName?: string;
    brand?: string;
    category?: KnowledgeProductCategory;
    subcategory?: string;
    features?: string[];
    specifications?: Record<string, string>;
    color?: string;
    minPrice?: number;
    maxPrice?: number;
    supplier?: string;
    targetAudience?: string;
    marketingGoal?: KnowledgeProductMarketingGoal;
    text?: string;
    limit?: number;
}
export interface ProductKnowledgeLearningPattern {
    patternId: string;
    patternType: "profile" | "visual" | "brand" | "marketing" | "customer" | "presentation" | "positioning";
    description: string;
    sourceProductId: string;
    confidence: number;
    detectedAt: string;
}
export interface ProductKnowledgeStatusReport {
    engineStatus: string;
    categoryAnalysisStatus: string;
    brandKnowledgeStatus: string;
    recommendationQuality: string;
    relationshipStatus: string;
    productsAnalyzed: number;
    patternsLearned: number;
    averageProductQualityScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageRecommendationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ProductKnowledgeEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map