/**
 * KWIZERA AI STUDIO — Image Knowledge Engine types (Step 4E)
 */
export declare enum ImageType {
    Product = "product",
    Lifestyle = "lifestyle",
    Marketing = "marketing",
    Brand = "brand",
    Packaging = "packaging",
    Banner = "banner",
    Social = "social",
    Catalog = "catalog",
    Other = "other"
}
export declare enum CreativeStyle {
    Modern = "modern",
    Luxury = "luxury",
    Minimal = "minimal",
    Commercial = "commercial",
    Editorial = "editorial",
    Rustic = "rustic"
}
export interface VisualElements {
    products: string[];
    objects: string[];
    logos: string[];
    textInImage: string[];
    colors: string[];
    dominantColors: string[];
    background: string;
    lighting: string;
    composition: string;
    cameraAngle: string;
    perspective: string;
    depth: string;
    texture: string;
    shadows: string;
    reflections: string;
    visualHierarchy: string;
}
export interface VisualMetrics {
    sharpness: number;
    brightness: number;
    contrast: number;
    saturation: number;
    colorBalance: number;
    whiteBalance: number;
    noise: number;
    resolution: string;
    aspectRatio: string;
    compositionQuality: number;
}
export interface ProductPresentation {
    position: string;
    visibility: number;
    focus: number;
    size: string;
    angle: string;
    background: string;
    category: string;
    branding: string;
    packaging: string;
}
export interface DesignKnowledge {
    layout: string;
    typography: string;
    colorHarmony: string;
    iconPlacement: string;
    visualBalance: number;
    creativeStyle: CreativeStyle;
}
export interface BrandKnowledge {
    logoPosition: string;
    brandColors: string[];
    brandTypography: string;
    brandIdentity: string;
    brandConsistency: number;
}
export interface ImageQualityScores {
    imageQualityScore: number;
    brandQualityScore: number;
    compositionScore: number;
    productVisibilityScore: number;
    marketingReadinessScore: number;
    aiConfidenceScore: number;
}
export interface ImageRelationships {
    similarImages: string[];
    similarProducts: string[];
    similarBrands: string[];
    similarStyles: string[];
    similarLayouts: string[];
    similarCampaigns: string[];
}
export interface VisualRecommendation {
    category: "background" | "lighting" | "composition" | "color-palette" | "product-position" | "branding" | "typography" | "design";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface ImageAnalysisInput {
    imageId?: string;
    imagePath: string;
    imageName: string;
    imageType?: ImageType;
    width?: number;
    height?: number;
    product?: string;
    brandName?: string;
    category?: string;
    language?: string;
    visual?: Partial<VisualElements>;
    metrics?: Partial<VisualMetrics>;
    productPresentation?: Partial<ProductPresentation>;
    design?: Partial<DesignKnowledge>;
    brandInfo?: Partial<BrandKnowledge>;
    tags?: string[];
    keywords?: string[];
    relatedKnowledge?: string[];
    relatedMemory?: string[];
}
export interface ImageAnalysisRecord {
    imageId: string;
    knowledgeId: string;
    imagePath: string;
    imageName: string;
    imageType: ImageType;
    visual: VisualElements;
    metrics: VisualMetrics;
    productPresentation: ProductPresentation;
    design: DesignKnowledge;
    brand: BrandKnowledge;
    scores: ImageQualityScores;
    relationships: ImageRelationships;
    recommendations: VisualRecommendation[];
    tags: string[];
    keywords: string[];
    language: string;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface ImageAnalysisResult {
    success: boolean;
    record?: ImageAnalysisRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ImageSearchQuery {
    imageType?: ImageType;
    product?: string;
    brand?: string;
    color?: string;
    style?: CreativeStyle;
    layout?: string;
    category?: string;
    minQuality?: number;
    minComposition?: number;
    language?: string;
    text?: string;
    limit?: number;
}
export interface ImageLearningPattern {
    patternId: string;
    patternType: "composition" | "color" | "branding" | "product-presentation" | "style";
    description: string;
    sourceImageId: string;
    confidence: number;
    detectedAt: string;
}
export interface ImageKnowledgeStatusReport {
    engineStatus: string;
    visualAnalysisStatus: string;
    relationshipStatus: string;
    imagesAnalyzed: number;
    patternsLearned: number;
    averageQualityScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageRecommendationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageKnowledgeEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map