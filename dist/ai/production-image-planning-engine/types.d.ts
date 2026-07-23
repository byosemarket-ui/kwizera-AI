/**
 * KWIZERA AI STUDIO — Production Image Planning Engine types (Step 6K)
 */
export declare enum ProductionImagePlatform {
    Instagram = "instagram",
    Facebook = "facebook",
    TikTok = "tiktok",
    YouTube = "youtube",
    WhatsApp = "whatsapp",
    Website = "website",
    Print = "print"
}
export declare enum ProductionWorkflowStep {
    ImageAnalysis = "image-analysis",
    EnhancementValidation = "enhancement-validation",
    AssetValidation = "asset-validation",
    CompositionValidation = "composition-validation",
    BackgroundValidation = "background-validation",
    BrandValidation = "brand-validation",
    CreativeValidation = "creative-validation",
    RenderingPreparation = "rendering-preparation",
    ExportPreparation = "export-preparation",
    DeliveryPreparation = "delivery-preparation"
}
export declare enum ProductionExportFormat {
    PNG = "png",
    JPG = "jpg",
    WEBP = "webp",
    SVG = "svg",
    PDF = "pdf"
}
export interface ProductionImageProfile {
    productionImagePlanId: string;
    projectId: string;
    imageId: string;
    product: string;
    brand: string;
    campaign: string;
    platform: ProductionImagePlatform;
    productionVersion: string;
}
export interface ProductionWorkflowPlanning {
    imageAnalysis: string;
    enhancementValidation: string;
    assetValidation: string;
    compositionValidation: string;
    backgroundValidation: string;
    brandValidation: string;
    creativeValidation: string;
    renderingPreparation: string;
    exportPreparation: string;
    deliveryPreparation: string;
}
export interface ProductionAssetItem {
    assetType: string;
    assetId: string;
    source: string;
    status: "ready" | "planned" | "missing";
    validationNote: string;
}
export interface ProductionAssetInventory {
    originalImages: ProductionAssetItem[];
    enhancedImages: ProductionAssetItem[];
    logos: ProductionAssetItem[];
    fonts: ProductionAssetItem[];
    icons: ProductionAssetItem[];
    backgrounds: ProductionAssetItem[];
    templates: ProductionAssetItem[];
    graphicElements: ProductionAssetItem[];
    qrCodes: ProductionAssetItem[];
    ctaAssets: ProductionAssetItem[];
    brandAssets: ProductionAssetItem[];
}
export interface ProductionDependencyCheck {
    moduleId: string;
    moduleName: string;
    required: boolean;
    present: boolean;
    validated: boolean;
    status: "passed" | "missing" | "invalid";
    detail: string;
}
export interface ProductionDependencyValidation {
    checks: ProductionDependencyCheck[];
    allRequiredPassed: boolean;
    passedCount: number;
    totalRequired: number;
}
export interface ProductionRenderPreparation {
    outputResolution: string;
    aspectRatio: string;
    imageFormat: string;
    colorProfile: string;
    compressionStrategy: string;
    exportQuality: string;
    renderingPriority: string;
}
export interface ProductionExportPreparation {
    png: string;
    jpg: string;
    webp: string;
    svg: string;
    pdf: string;
    additionalFormatsSupported: boolean;
}
export interface ProductionPlatformRules {
    instagram: string;
    facebook: string;
    tiktok: string;
    youtube: string;
    whatsapp: string;
    website: string;
    print: string;
}
export interface ProductionRecoveryPlan {
    dependencyRecovery: string;
    assetRecovery: string;
    workflowRecovery: string;
    renderRecovery: string;
    exportRecovery: string;
    rollbackStrategy: string;
}
export interface ProductionImagePlanningScores {
    productionReadinessScore: number;
    assetReadinessScore: number;
    workflowReadinessScore: number;
    dependencyScore: number;
    performanceScore: number;
    aiConfidenceScore: number;
}
export interface ProductionImagePlanningRelationships {
    relatedCreativeImagePlans: string[];
    relatedEnhancementPlans: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    relatedMarketingStrategy: string[];
    relatedKnowledge: string[];
    relatedProductionHistory: string[];
    relatedProjects: string[];
}
export interface ProductionImagePlanningRecommendation {
    category: "workflow" | "asset" | "dependency" | "render" | "export" | "recovery" | "platform";
    suggestion: string;
    priority: "low" | "medium" | "high";
    reason: string;
}
export interface ProductionImagePlanningInput {
    imageId: string;
    projectId?: string;
    campaign?: string;
    platform?: ProductionImagePlatform;
    workflowSteps?: ProductionWorkflowStep[];
    exportFormats?: ProductionExportFormat[];
    relatedProjects?: string[];
    relatedKnowledge?: string[];
    keywords?: string[];
}
export interface ProductionImagePlanningRecord {
    imageId: string;
    profile: ProductionImageProfile;
    analysisId: string;
    understandingId: string;
    detectionId: string;
    backgroundId: string;
    compositionId: string;
    lightingColorId: string;
    brandVisualId: string;
    enhancementPlanId: string;
    creativeImagePlanId: string;
    workflow: ProductionWorkflowPlanning;
    assets: ProductionAssetInventory;
    dependencies: ProductionDependencyValidation;
    renderPreparation: ProductionRenderPreparation;
    exportPreparation: ProductionExportPreparation;
    platformRules: ProductionPlatformRules;
    recoveryPlan: ProductionRecoveryPlan;
    scores: ProductionImagePlanningScores;
    relationships: ProductionImagePlanningRelationships;
    recommendations: ProductionImagePlanningRecommendation[];
    keywords: string[];
    productionReady: boolean;
    validated: boolean;
    plannedAt: string;
    lastUpdated: string;
    version: number;
}
export interface ProductionImagePlanningResult {
    success: boolean;
    record?: ProductionImagePlanningRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface ProductionImagePlanningSearchQuery {
    productionPlanId?: string;
    imageId?: string;
    brand?: string;
    product?: string;
    platform?: ProductionImagePlatform;
    campaign?: string;
    workflow?: ProductionWorkflowStep;
    asset?: string;
    minReadinessScore?: number;
    keywords?: string[];
    limit?: number;
}
export interface ProductionImagePlanningEngineStatusReport {
    engineStatus: string;
    workflowPlanningStatus: string;
    assetValidationStatus: string;
    dependencyValidationStatus: string;
    renderPreparationStatus: string;
    exportPreparationStatus: string;
    relationshipStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    plansCreated: number;
    averageProductionReadinessScore: number;
    averageAssetReadinessScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
        averageRelationshipMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ProductionImagePlanningEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map