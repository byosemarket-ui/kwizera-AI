/**
 * KWIZERA AI STUDIO — Text-to-Image Generation Engine types (Step 9B)
 */
import type { CreativeDirectionStyle } from "../creative-direction-engine/types.js";
export declare enum TextToImagePlatform {
    Website = "website",
    Mobile = "mobile",
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    LinkedIn = "linkedin",
    Print = "print",
    Billboard = "billboard"
}
export declare enum TextToImageInputType {
    TextPrompt = "text-prompt",
    ProductInformation = "product-information",
    BrandGuidelines = "brand-guidelines",
    Campaign = "campaign",
    StyleReferences = "style-references",
    KnowledgeRecord = "knowledge-record"
}
export declare enum ImageArtisticStyle {
    Photorealistic = "photorealistic",
    Commercial = "commercial",
    Luxury = "luxury",
    Corporate = "corporate",
    Cartoon = "cartoon",
    Illustration = "illustration",
    ThreeDRender = "3d-render",
    Minimal = "minimal",
    Fashion = "fashion",
    ProductPhotography = "product-photography"
}
export declare enum ProductImageType {
    HeroImage = "hero-image",
    ProductShowcase = "product-showcase",
    LifestyleImage = "lifestyle-image",
    PackagingView = "packaging-view",
    CloseUp = "close-up",
    DetailView = "detail-view"
}
export declare enum ImageVariationType {
    VariationA = "variation-a",
    VariationB = "variation-b",
    VariationC = "variation-c",
    StyleVariation = "style-variation",
    CompositionVariation = "composition-variation",
    ColorVariation = "color-variation"
}
export interface ImagePlanProfile {
    imagePlanId: string;
    promptId: string;
    projectId: string;
    productId: string;
    brandId: string;
    platform: TextToImagePlatform;
    style: ImageArtisticStyle;
    version: number;
    language: string;
    productImageType?: ProductImageType;
}
export interface PromptAnalysis {
    subject: string;
    environment: string;
    objects: string[];
    mood: string;
    emotion: string;
    cameraPerspective: string;
    composition: string;
    lighting: string;
    colorPalette: string[];
    artisticStyle: ImageArtisticStyle;
}
export interface CompositionPlan {
    composition: string;
    background: string;
    foreground: string;
    subjectPlacement: string;
    objectPlacement: string;
    cameraAngle: string;
    cameraDistance: string;
    perspective: string;
}
export interface LightingPlan {
    naturalLighting: string;
    studioLighting: string;
    dramaticLighting: string;
    rimLight: string;
    softLight: string;
    hardLight: string;
    hdrPreparation: string;
}
export interface StylePlan {
    style: ImageArtisticStyle;
    styleNotes: string;
    referenceStyles: string[];
    brandAlignment: string;
}
export interface ColorPlan {
    primaryColors: string[];
    accentColors: string[];
    brandColors: string[];
    contrast: string;
    saturation: string;
    whiteBalance: string;
}
export interface PlatformImageOptimization {
    platform: TextToImagePlatform;
    aspectRatio: string;
    resolution: string;
    safeZones: string[];
    formatNotes: string[];
    optimizationNotes: string[];
}
export interface ImageVariation {
    variationId: string;
    variationType: ImageVariationType;
    label: string;
    compositionAdjustment: string;
    styleAdjustment: string;
    colorAdjustment: string;
}
export interface ProductionImageInstructions {
    renderNotes: string[];
    layerGuidance: string[];
    maskGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
}
export interface TextToImageScores {
    promptQualityScore: number;
    compositionScore: number;
    styleScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface TextToImageRelationships {
    prompts: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    images: string[];
    knowledgeRecords: string[];
    productionPlans: string[];
    creativeDirections: string[];
    marketingStrategies: string[];
}
export interface TextToImageGenerationInput {
    textPrompt?: string;
    productId?: string;
    projectId?: string;
    campaignId?: string;
    brandId?: string;
    brandName?: string;
    platform?: TextToImagePlatform;
    language?: string;
    style?: ImageArtisticStyle;
    productImageType?: ProductImageType;
    styleReferenceIds?: string[];
    knowledgeRecordIds?: string[];
    brandGuidelines?: string;
    generateVariations?: boolean;
    generatePlatformOptimizations?: boolean;
    inputTypes?: TextToImageInputType[];
}
export interface TextToImageGenerationRecord {
    imagePlanId: string;
    profile: ImagePlanProfile;
    promptAnalysis: PromptAnalysis;
    compositionPlan: CompositionPlan;
    lightingPlan: LightingPlan;
    stylePlan: StylePlan;
    colorPlan: ColorPlan;
    platformOptimizations: PlatformImageOptimization[];
    variations: ImageVariation[];
    productionInstructions: ProductionImageInstructions;
    blueprintId?: string;
    scores: TextToImageScores;
    relationships: TextToImageRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface TextToImageGenerationResult {
    success: boolean;
    record?: TextToImageGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface TextToImageSearchQuery {
    imagePlanId?: string;
    promptId?: string;
    productId?: string;
    brandId?: string;
    platform?: TextToImagePlatform;
    style?: ImageArtisticStyle;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface TextToImageGenerationEngineStatusReport {
    engineStatus: string;
    promptAnalysisStatus: string;
    compositionPlanningStatus: string;
    stylePlanningStatus: string;
    platformOptimizationStatus: string;
    imagePlansGenerated: number;
    averagePromptQualityScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averageGenerationMs: number;
        averageSearchMs: number;
        averageBlueprintMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class TextToImageGenerationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ALL_TEXT_TO_IMAGE_PLATFORMS: TextToImagePlatform[];
export declare const PLATFORM_CONFIG: Record<TextToImagePlatform, {
    aspectRatio: string;
    resolution: string;
    width: number;
    height: number;
}>;
export type { CreativeDirectionStyle };
//# sourceMappingURL=types.d.ts.map