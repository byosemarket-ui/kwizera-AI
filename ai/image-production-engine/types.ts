/**
 * KWIZERA AI STUDIO — Image Production Engine types (Step 9J)
 */

export enum ImageProductionPlatform {
  Website = "website",
  Mobile = "mobile",
  Instagram = "instagram",
  Facebook = "facebook",
  TikTok = "tiktok",
  LinkedIn = "linkedin",
  Print = "print",
  Packaging = "packaging",
  Billboard = "billboard",
}

export enum ImageProductionWorkflowStage {
  TextToImage = "text-to-image",
  ImageToImage = "image-to-image",
  ProductImageGeneration = "product-image-generation",
  BackgroundGeneration = "background-generation",
  ImageEditing = "image-editing",
  ImageEnhancement = "image-enhancement",
  Branding = "branding",
  MultiStyleGeneration = "multi-style-generation",
  ProductionWorkflow = "production-workflow",
}

export enum ImageProductionAssetType {
  SourceImage = "source-image",
  GeneratedImage = "generated-image",
  Logo = "logo",
  Font = "font",
  Icon = "icon",
  Template = "template",
  Layer = "layer",
  Mask = "mask",
  Texture = "texture",
  BrandAsset = "brand-asset",
  ColorProfile = "color-profile",
  Metadata = "metadata",
}

export enum ImageProductionDependency {
  MemoryEngine = "memory-engine",
  KnowledgeEngine = "knowledge-engine",
  ProductIntelligenceEngine = "product-intelligence-engine",
  ImageIntelligenceEngine = "image-intelligence-engine",
  VideoIntelligenceEngine = "video-intelligence-engine",
  ImageGenerationFoundation = "image-generation-foundation",
  TextToImageEngine = "text-to-image-generation-engine",
  ImageToImageEngine = "image-to-image-generation-engine",
  ProductImageEngine = "product-image-generation-engine",
  BackgroundEngine = "background-generation-engine",
  ImageEditingEngine = "image-editing-generation-engine",
  EnhancementEngine = "image-enhancement-generation-engine",
  BrandingEngine = "branding-design-generation-engine",
  MultiStyleEngine = "multi-style-image-generation-engine",
}

export enum ImageProductionExportFormat {
  Png = "png",
  Jpg = "jpg",
  Webp = "webp",
  Tiff = "tiff",
  Svg = "svg",
  Pdf = "pdf",
}

export enum ImageProductionColorSpace {
  Rgb = "rgb",
  Cmyk = "cmyk",
}

export interface ImageProductionProfile {
  imageProductionId: string;
  projectId: string;
  imagePlanId: string;
  productId: string;
  brandId: string;
  campaignId: string;
  platform: ImageProductionPlatform;
  productionVersion: number;
  language: string;
}

export interface WorkflowValidationEntry {
  stage: ImageProductionWorkflowStage;
  validated: boolean;
  moduleId: string;
  status: string;
  notes: string[];
}

export interface AssetValidationEntry {
  assetType: ImageProductionAssetType;
  assetId: string;
  validated: boolean;
  source: string;
  notes: string[];
}

export interface DependencyValidationEntry {
  dependency: ImageProductionDependency;
  available: boolean;
  moduleId?: string;
  notes: string[];
}

export interface ProductionLayerEntry {
  layerId: string;
  name: string;
  order: number;
  type: string;
  visible: boolean;
  locked: boolean;
}

export interface ProductionMaskEntry {
  maskId: string;
  layerId: string;
  type: string;
  validated: boolean;
}

export interface ProductionStructure {
  layerStructure: ProductionLayerEntry[];
  maskStructure: ProductionMaskEntry[];
  objectHierarchy: string[];
  assetHierarchy: string[];
  colorManagement: {
    primaryColorSpace: ImageProductionColorSpace;
    iccProfile: string;
    brandColors: string[];
  };
  metadataStructure: Record<string, string>;
  versionStructure: {
    currentVersion: number;
    historyRef: string;
  };
}

export interface RenderPreparationPlan {
  resolution: string;
  dpi: number;
  aspectRatio: string;
  colorSpace: ImageProductionColorSpace;
  rgbProfile: string;
  cmykProfile: string;
  iccProfiles: string[];
  compressionStrategy: string;
  outputQuality: number;
  instructions: string[];
}

export interface ExportPreparationEntry {
  format: ImageProductionExportFormat;
  enabled: boolean;
  quality: number;
  colorSpace: ImageProductionColorSpace;
  notes: string[];
}

export interface ExportPreparationPlan {
  exports: ExportPreparationEntry[];
  extensibleFormats: string[];
}

export interface DeliveryInstructions {
  platform: ImageProductionPlatform;
  deliveryTargets: string[];
  packagingNotes: string[];
  distributionNotes: string[];
}

export interface RecoveryPlan {
  recoveryId: string;
  checkpoints: string[];
  rollbackSteps: string[];
  assetRecoveryRefs: string[];
}

export interface PlatformProductionRules {
  platform: ImageProductionPlatform;
  resolution: string;
  aspectRatio: string;
  exportFormats: ImageProductionExportFormat[];
  rules: string[];
}

export interface ImageProductionScores {
  productionReadinessScore: number;
  assetReadinessScore: number;
  workflowScore: number;
  layerIntegrityScore: number;
  dependencyScore: number;
  performanceScore: number;
  aiConfidenceScore: number;
}

export interface ImageProductionRelationships {
  imagePlans: string[];
  productionPlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  templates: string[];
  knowledgeRecords: string[];
  stylePlans: string[];
  brandingPlans: string[];
  productImagePlans: string[];
  generatedImages: string[];
  sourceImages: string[];
}

export interface ImageProductionInput {
  productId?: string;
  projectId?: string;
  imagePlanId?: string;
  stylePlanId?: string;
  brandingPlanId?: string;
  productImagePlanId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: ImageProductionPlatform;
  language?: string;
  templateIds?: string[];
  knowledgeRecordIds?: string[];
  validateAllWorkflows?: boolean;
  validateAllAssets?: boolean;
  prepareExports?: boolean;
  preparePlatformRules?: boolean;
}

export interface ImageProductionRecord {
  imageProductionId: string;
  profile: ImageProductionProfile;
  workflowValidation: WorkflowValidationEntry[];
  assetValidation: AssetValidationEntry[];
  dependencyValidation: DependencyValidationEntry[];
  productionStructure: ProductionStructure;
  renderPreparation: RenderPreparationPlan;
  exportPreparation: ExportPreparationPlan;
  deliveryInstructions: DeliveryInstructions;
  recoveryPlan: RecoveryPlan;
  platformRules: PlatformProductionRules[];
  blueprintId?: string;
  scores: ImageProductionScores;
  relationships: ImageProductionRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface ImageProductionResult {
  success: boolean;
  record?: ImageProductionRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ImageProductionSearchQuery {
  imageProductionId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: ImageProductionPlatform;
  assetId?: string;
  templateId?: string;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface ImageProductionEngineStatusReport {
  engineStatus: string;
  workflowValidationStatus: string;
  assetValidationStatus: string;
  dependencyValidationStatus: string;
  productionPlansGenerated: number;
  averageProductionReadinessScore: number;
  averageWorkflowScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averagePlanningMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ImageProductionEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageProductionEngineError";
  }
}

export const ALL_IMAGE_PRODUCTION_PLATFORMS: ImageProductionPlatform[] = [
  ImageProductionPlatform.Website,
  ImageProductionPlatform.Mobile,
  ImageProductionPlatform.Instagram,
  ImageProductionPlatform.Facebook,
  ImageProductionPlatform.TikTok,
  ImageProductionPlatform.LinkedIn,
  ImageProductionPlatform.Print,
  ImageProductionPlatform.Packaging,
  ImageProductionPlatform.Billboard,
];

export const ALL_IMAGE_PRODUCTION_WORKFLOW_STAGES: ImageProductionWorkflowStage[] = [
  ImageProductionWorkflowStage.TextToImage,
  ImageProductionWorkflowStage.ImageToImage,
  ImageProductionWorkflowStage.ProductImageGeneration,
  ImageProductionWorkflowStage.BackgroundGeneration,
  ImageProductionWorkflowStage.ImageEditing,
  ImageProductionWorkflowStage.ImageEnhancement,
  ImageProductionWorkflowStage.Branding,
  ImageProductionWorkflowStage.MultiStyleGeneration,
  ImageProductionWorkflowStage.ProductionWorkflow,
];

export const ALL_IMAGE_PRODUCTION_ASSET_TYPES: ImageProductionAssetType[] = [
  ImageProductionAssetType.SourceImage,
  ImageProductionAssetType.GeneratedImage,
  ImageProductionAssetType.Logo,
  ImageProductionAssetType.Font,
  ImageProductionAssetType.Icon,
  ImageProductionAssetType.Template,
  ImageProductionAssetType.Layer,
  ImageProductionAssetType.Mask,
  ImageProductionAssetType.Texture,
  ImageProductionAssetType.BrandAsset,
  ImageProductionAssetType.ColorProfile,
  ImageProductionAssetType.Metadata,
];

export const ALL_IMAGE_PRODUCTION_DEPENDENCIES: ImageProductionDependency[] = [
  ImageProductionDependency.MemoryEngine,
  ImageProductionDependency.KnowledgeEngine,
  ImageProductionDependency.ProductIntelligenceEngine,
  ImageProductionDependency.ImageIntelligenceEngine,
  ImageProductionDependency.VideoIntelligenceEngine,
  ImageProductionDependency.ImageGenerationFoundation,
  ImageProductionDependency.TextToImageEngine,
  ImageProductionDependency.ImageToImageEngine,
  ImageProductionDependency.ProductImageEngine,
  ImageProductionDependency.BackgroundEngine,
  ImageProductionDependency.ImageEditingEngine,
  ImageProductionDependency.EnhancementEngine,
  ImageProductionDependency.BrandingEngine,
  ImageProductionDependency.MultiStyleEngine,
];

export const ALL_IMAGE_PRODUCTION_EXPORT_FORMATS: ImageProductionExportFormat[] = [
  ImageProductionExportFormat.Png,
  ImageProductionExportFormat.Jpg,
  ImageProductionExportFormat.Webp,
  ImageProductionExportFormat.Tiff,
  ImageProductionExportFormat.Svg,
  ImageProductionExportFormat.Pdf,
];

export const IMAGE_PRODUCTION_PLATFORM_CONFIG: Record<
  ImageProductionPlatform,
  { aspectRatio: string; resolution: string; width: number; height: number; dpi: number }
> = {
  [ImageProductionPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080, dpi: 72 },
  [ImageProductionPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920, dpi: 72 },
  [ImageProductionPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080, dpi: 72 },
  [ImageProductionPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628, dpi: 72 },
  [ImageProductionPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920, dpi: 72 },
  [ImageProductionPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627, dpi: 72 },
  [ImageProductionPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000, dpi: 300 },
  [ImageProductionPlatform.Packaging]: { aspectRatio: "1:1", resolution: "2048x2048", width: 2048, height: 2048, dpi: 300 },
  [ImageProductionPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000, dpi: 150 },
};

export const WORKFLOW_MODULE_MAP: Record<ImageProductionWorkflowStage, string> = {
  [ImageProductionWorkflowStage.TextToImage]: "text-to-image-generation-engine",
  [ImageProductionWorkflowStage.ImageToImage]: "image-to-image-generation-engine",
  [ImageProductionWorkflowStage.ProductImageGeneration]: "product-image-generation-engine",
  [ImageProductionWorkflowStage.BackgroundGeneration]: "background-generation-engine",
  [ImageProductionWorkflowStage.ImageEditing]: "image-editing-generation-engine",
  [ImageProductionWorkflowStage.ImageEnhancement]: "image-enhancement-generation-engine",
  [ImageProductionWorkflowStage.Branding]: "branding-design-generation-engine",
  [ImageProductionWorkflowStage.MultiStyleGeneration]: "multi-style-image-generation-engine",
  [ImageProductionWorkflowStage.ProductionWorkflow]: "image-production-engine",
};

export const DEPENDENCY_MODULE_MAP: Partial<Record<ImageProductionDependency, string>> = {
  [ImageProductionDependency.TextToImageEngine]: "text-to-image-generation-engine",
  [ImageProductionDependency.ImageToImageEngine]: "image-to-image-generation-engine",
  [ImageProductionDependency.ProductImageEngine]: "product-image-generation-engine",
  [ImageProductionDependency.BackgroundEngine]: "background-generation-engine",
  [ImageProductionDependency.ImageEditingEngine]: "image-editing-generation-engine",
  [ImageProductionDependency.EnhancementEngine]: "image-enhancement-generation-engine",
  [ImageProductionDependency.BrandingEngine]: "branding-design-generation-engine",
  [ImageProductionDependency.MultiStyleEngine]: "multi-style-image-generation-engine",
};
