/**
 * KWIZERA AI STUDIO — Image Analysis Engine types (Step 6B)
 */
export declare enum ImageFileFormat {
    JPEG = "jpeg",
    PNG = "png",
    WebP = "webp",
    GIF = "gif",
    TIFF = "tiff",
    BMP = "bmp",
    SVG = "svg",
    HEIC = "heic",
    Other = "other"
}
export declare enum ImageOrientation {
    Landscape = "landscape",
    Portrait = "portrait",
    Square = "square"
}
export declare enum ImageColorSpace {
    SRGB = "srgb",
    AdobeRGB = "adobe-rgb",
    DisplayP3 = "display-p3",
    CMYK = "cmyk",
    Grayscale = "grayscale",
    Unknown = "unknown"
}
export declare enum ImageCompressionType {
    Lossless = "lossless",
    Lossy = "lossy",
    Uncompressed = "uncompressed",
    Unknown = "unknown"
}
export declare enum ImageAnalysisType {
    ProductImage = "product-image",
    LifestyleImage = "lifestyle-image",
    MarketingImage = "marketing-image",
    Logo = "logo",
    Banner = "banner",
    Poster = "poster",
    Screenshot = "screenshot",
    Background = "background",
    Other = "other"
}
export interface ImageTechnicalProfile {
    imageName: string;
    imageId: string;
    filePath: string;
    fileFormat: ImageFileFormat;
    fileSizeBytes: number;
    resolution: string;
    width: number;
    height: number;
    aspectRatio: string;
    orientation: ImageOrientation;
    colorSpace: ImageColorSpace;
    bitDepth: number;
    compressionType: ImageCompressionType;
    hasTransparency: boolean;
    metadata: Record<string, string>;
    creationDate?: string;
    lastModifiedDate?: string;
}
export interface ImageVisualAnalysis {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    noiseLevel: number;
    whiteBalance: number;
    exposure: number;
    dynamicRange: number;
    colorDistribution: Record<string, number>;
    dominantColors: string[];
}
export interface ImageContentPreparation {
    objects: string[];
    products: string[];
    logos: string[];
    text: string[];
    background: string;
    foreground: string;
    shapes: string[];
    patterns: string[];
}
export interface ImageClassification {
    imageType: ImageAnalysisType;
    category: string;
    subcategory: string;
    creativeStyle: string;
    useCase: string;
}
export interface ImageCompletenessScores {
    imageCompletenessScore: number;
    technicalQualityScore: number;
    visualQualityScore: number;
    analysisConfidenceScore: number;
}
export interface ImageAnalysisRelationships {
    relatedProducts: string[];
    relatedBrands: string[];
    relatedProjects: string[];
    relatedMarketingCampaigns: string[];
    relatedCreativeStyles: string[];
    relatedKnowledge: string[];
    relatedImages: string[];
    relatedMemory: string[];
}
export interface ImageAnalysisEngineInput {
    imageId?: string;
    imageName?: string;
    filePath?: string;
    fileFormat?: ImageFileFormat;
    fileSizeBytes?: number;
    width?: number;
    height?: number;
    colorSpace?: ImageColorSpace;
    bitDepth?: number;
    compressionType?: ImageCompressionType;
    hasTransparency?: boolean;
    metadata?: Record<string, string>;
    creationDate?: string;
    lastModifiedDate?: string;
    visual?: Partial<ImageVisualAnalysis>;
    content?: Partial<ImageContentPreparation>;
    imageType?: ImageAnalysisType;
    category?: string;
    subcategory?: string;
    creativeStyle?: string;
    useCase?: string;
    product?: string;
    brand?: string;
    projectId?: string;
    campaign?: string;
    tags?: string[];
    keywords?: string[];
    relatedKnowledge?: string[];
    relatedMemory?: string[];
    relatedProjects?: string[];
    relatedImages?: string[];
}
export interface ImageAnalysisIntelligenceRecord {
    imageId: string;
    analysisId: string;
    knowledgeId?: string;
    technical: ImageTechnicalProfile;
    visual: ImageVisualAnalysis;
    content: ImageContentPreparation;
    classification: ImageClassification;
    scores: ImageCompletenessScores;
    relationships: ImageAnalysisRelationships;
    missingFields: string[];
    tags: string[];
    keywords: string[];
    validated: boolean;
    analyzedAt: string;
    lastUpdated: string;
    version: number;
}
export interface ImageAnalysisEngineResult {
    success: boolean;
    record?: ImageAnalysisIntelligenceRecord;
    durationMs: number;
    diagnostics: string[];
    missingFields: string[];
    message?: string;
}
export interface ImageAnalysisSearchQuery {
    imageName?: string;
    imageType?: ImageAnalysisType;
    product?: string;
    brand?: string;
    resolution?: string;
    aspectRatio?: string;
    dominantColor?: string;
    tags?: string[];
    keywords?: string[];
    text?: string;
    limit?: number;
}
export interface ImageAnalysisEngineStatusReport {
    engineStatus: string;
    classificationStatus: string;
    relationshipStatus: string;
    completenessStatus: string;
    knowledgeBridgeStatus: string;
    memoryBridgeStatus: string;
    productIntelligenceBridgeStatus: string;
    imagesAnalyzed: number;
    averageCompletenessScore: number;
    averageConfidenceScore: number;
    performance: {
        averageAnalysisMs: number;
        averageSearchMs: number;
        averageClassificationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageAnalysisEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map