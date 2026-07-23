/**
 * KWIZERA AI STUDIO — Image Rendering Preparation Engine types (Step 9K)
 */

export enum ImageRenderPlatform {
  Website = "website",
  Mobile = "mobile",
  Instagram = "instagram",
  Facebook = "facebook",
  TikTok = "tiktok",
  LinkedIn = "linkedin",
  Print = "print",
  Packaging = "packaging",
  Catalogue = "catalogue",
  Billboard = "billboard",
}

export enum ImageRenderValidationStage {
  TextToImage = "text-to-image",
  ImageToImage = "image-to-image",
  ProductImageGeneration = "product-image-generation",
  BackgroundGeneration = "background-generation",
  ImageEditing = "image-editing",
  ImageEnhancement = "image-enhancement",
  Branding = "branding",
  MultiStyleGeneration = "multi-style-generation",
  ProductionPlans = "production-plans",
}

export enum ImageRenderLayerCheck {
  LayerHierarchy = "layer-hierarchy",
  LayerOrder = "layer-order",
  LayerVisibility = "layer-visibility",
  LayerGroups = "layer-groups",
  BlendModes = "blend-modes",
  Opacity = "opacity",
  ClippingMasks = "clipping-masks",
}

export enum ImageRenderMaskType {
  SubjectMask = "subject-mask",
  ObjectMask = "object-mask",
  BackgroundMask = "background-mask",
  LayerMask = "layer-mask",
  AlphaMask = "alpha-mask",
  EditableRegion = "editable-region",
}

export enum ImageRenderAssetType {
  SourceImage = "source-image",
  GeneratedImage = "generated-image",
  Logo = "logo",
  Font = "font",
  Icon = "icon",
  Template = "template",
  Texture = "texture",
  BrandAsset = "brand-asset",
  IccProfile = "icc-profile",
  Metadata = "metadata",
}

export enum ImageRenderColorSpace {
  Rgb = "rgb",
  Cmyk = "cmyk",
}

export interface ImageRenderPlanProfile {
  imageRenderPlanId: string;
  projectId: string;
  productionId: string;
  imageId: string;
  platform: ImageRenderPlatform;
  renderVersion: number;
  language: string;
}

export interface RenderValidationEntry {
  stage: ImageRenderValidationStage;
  validated: boolean;
  moduleId: string;
  status: string;
  notes: string[];
}

export interface LayerValidationEntry {
  check: ImageRenderLayerCheck;
  validated: boolean;
  layerCount: number;
  notes: string[];
}

export interface MaskValidationEntry {
  maskType: ImageRenderMaskType;
  maskId: string;
  validated: boolean;
  notes: string[];
}

export interface RenderAssetValidationEntry {
  assetType: ImageRenderAssetType;
  assetId: string;
  validated: boolean;
  source: string;
  notes: string[];
}

export interface RenderLayerEntry {
  layerId: string;
  name: string;
  order: number;
  group: string;
  blendMode: string;
  opacity: number;
  visible: boolean;
  clippingMask: boolean;
}

export interface RenderSettingsPlan {
  resolution: string;
  dpi: number;
  aspectRatio: string;
  rgbProfile: string;
  cmykProfile: string;
  iccProfile: string;
  bitDepth: number;
  colorSpace: ImageRenderColorSpace;
  compressionStrategy: string;
  outputQuality: number;
  alphaChannel: boolean;
  instructions: string[];
}

export interface OutputProfileEntry {
  platform: ImageRenderPlatform;
  resolution: string;
  aspectRatio: string;
  colorSpace: ImageRenderColorSpace;
  dpi: number;
  rules: string[];
}

export interface ResourcePlanningPlan {
  cpuAllocation: string;
  gpuAllocation: string;
  ramAllocation: string;
  storageAllocation: string;
  cacheAllocation: string;
  temporaryFiles: string[];
  renderQueue: string[];
  parallelRenderingPreparation: boolean;
  notes: string[];
}

export interface RenderJobPlan {
  jobId: string;
  renderPlanId: string;
  priority: number;
  status: string;
  platform: ImageRenderPlatform;
  estimatedResources: string;
}

export interface RenderRecoveryPlan {
  recoveryId: string;
  checkpoints: string[];
  resumeSteps: string[];
  rollbackSteps: string[];
  automaticRecovery: boolean;
  failureDetection: string[];
}

export interface ImageRenderScores {
  renderReadinessScore: number;
  assetQualityScore: number;
  layerIntegrityScore: number;
  maskIntegrityScore: number;
  performanceScore: number;
  platformCompatibilityScore: number;
  aiConfidenceScore: number;
}

export interface ImageRenderRelationships {
  imagePlans: string[];
  productionPlans: string[];
  renderPlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  templates: string[];
  knowledgeRecords: string[];
  stylePlans: string[];
}

export interface ImageRenderInput {
  productId?: string;
  projectId?: string;
  productionId?: string;
  imageId?: string;
  stylePlanId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: ImageRenderPlatform;
  language?: string;
  templateIds?: string[];
  knowledgeRecordIds?: string[];
  validateLayers?: boolean;
  validateMasks?: boolean;
  validateAssets?: boolean;
  planResources?: boolean;
  prepareOutputProfiles?: boolean;
  generateRenderJobs?: boolean;
}

export interface ImageRenderRecord {
  imageRenderPlanId: string;
  profile: ImageRenderPlanProfile;
  renderValidation: RenderValidationEntry[];
  layerValidation: LayerValidationEntry[];
  maskValidation: MaskValidationEntry[];
  assetValidation: RenderAssetValidationEntry[];
  layerStructure: RenderLayerEntry[];
  renderSettings: RenderSettingsPlan;
  outputProfiles: OutputProfileEntry[];
  resourcePlanning: ResourcePlanningPlan;
  renderJobs: RenderJobPlan[];
  recoveryPlan: RenderRecoveryPlan;
  blueprintId?: string;
  scores: ImageRenderScores;
  relationships: ImageRenderRelationships;
  recommendations: string[];
  validated: boolean;
  renderReady: boolean;
  productionReady: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface ImageRenderResult {
  success: boolean;
  record?: ImageRenderRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ImageRenderSearchQuery {
  imageRenderPlanId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: ImageRenderPlatform;
  resolution?: string;
  colorSpace?: ImageRenderColorSpace;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface ImageRenderEngineStatusReport {
  engineStatus: string;
  renderValidationStatus: string;
  layerValidationStatus: string;
  maskValidationStatus: string;
  resourcePlanningStatus: string;
  renderPlansGenerated: number;
  averageRenderReadinessScore: number;
  averageLayerIntegrityScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averagePlanningMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ImageRenderEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageRenderEngineError";
  }
}

export const ALL_IMAGE_RENDER_PLATFORMS: ImageRenderPlatform[] = [
  ImageRenderPlatform.Website,
  ImageRenderPlatform.Mobile,
  ImageRenderPlatform.Instagram,
  ImageRenderPlatform.Facebook,
  ImageRenderPlatform.TikTok,
  ImageRenderPlatform.LinkedIn,
  ImageRenderPlatform.Print,
  ImageRenderPlatform.Packaging,
  ImageRenderPlatform.Catalogue,
  ImageRenderPlatform.Billboard,
];

export const ALL_IMAGE_RENDER_VALIDATION_STAGES: ImageRenderValidationStage[] = [
  ImageRenderValidationStage.TextToImage,
  ImageRenderValidationStage.ImageToImage,
  ImageRenderValidationStage.ProductImageGeneration,
  ImageRenderValidationStage.BackgroundGeneration,
  ImageRenderValidationStage.ImageEditing,
  ImageRenderValidationStage.ImageEnhancement,
  ImageRenderValidationStage.Branding,
  ImageRenderValidationStage.MultiStyleGeneration,
  ImageRenderValidationStage.ProductionPlans,
];

export const ALL_IMAGE_RENDER_LAYER_CHECKS: ImageRenderLayerCheck[] = [
  ImageRenderLayerCheck.LayerHierarchy,
  ImageRenderLayerCheck.LayerOrder,
  ImageRenderLayerCheck.LayerVisibility,
  ImageRenderLayerCheck.LayerGroups,
  ImageRenderLayerCheck.BlendModes,
  ImageRenderLayerCheck.Opacity,
  ImageRenderLayerCheck.ClippingMasks,
];

export const ALL_IMAGE_RENDER_MASK_TYPES: ImageRenderMaskType[] = [
  ImageRenderMaskType.SubjectMask,
  ImageRenderMaskType.ObjectMask,
  ImageRenderMaskType.BackgroundMask,
  ImageRenderMaskType.LayerMask,
  ImageRenderMaskType.AlphaMask,
  ImageRenderMaskType.EditableRegion,
];

export const ALL_IMAGE_RENDER_ASSET_TYPES: ImageRenderAssetType[] = [
  ImageRenderAssetType.SourceImage,
  ImageRenderAssetType.GeneratedImage,
  ImageRenderAssetType.Logo,
  ImageRenderAssetType.Font,
  ImageRenderAssetType.Icon,
  ImageRenderAssetType.Template,
  ImageRenderAssetType.Texture,
  ImageRenderAssetType.BrandAsset,
  ImageRenderAssetType.IccProfile,
  ImageRenderAssetType.Metadata,
];

export const IMAGE_RENDER_PLATFORM_CONFIG: Record<
  ImageRenderPlatform,
  { aspectRatio: string; resolution: string; width: number; height: number; dpi: number }
> = {
  [ImageRenderPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080, dpi: 72 },
  [ImageRenderPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920, dpi: 72 },
  [ImageRenderPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080, dpi: 72 },
  [ImageRenderPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628, dpi: 72 },
  [ImageRenderPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920, dpi: 72 },
  [ImageRenderPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627, dpi: 72 },
  [ImageRenderPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000, dpi: 300 },
  [ImageRenderPlatform.Packaging]: { aspectRatio: "1:1", resolution: "2048x2048", width: 2048, height: 2048, dpi: 300 },
  [ImageRenderPlatform.Catalogue]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000, dpi: 300 },
  [ImageRenderPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000, dpi: 150 },
};

export const RENDER_VALIDATION_MODULE_MAP: Record<ImageRenderValidationStage, string> = {
  [ImageRenderValidationStage.TextToImage]: "text-to-image-generation-engine",
  [ImageRenderValidationStage.ImageToImage]: "image-to-image-generation-engine",
  [ImageRenderValidationStage.ProductImageGeneration]: "product-image-generation-engine",
  [ImageRenderValidationStage.BackgroundGeneration]: "background-generation-engine",
  [ImageRenderValidationStage.ImageEditing]: "image-editing-generation-engine",
  [ImageRenderValidationStage.ImageEnhancement]: "image-enhancement-generation-engine",
  [ImageRenderValidationStage.Branding]: "branding-design-generation-engine",
  [ImageRenderValidationStage.MultiStyleGeneration]: "multi-style-image-generation-engine",
  [ImageRenderValidationStage.ProductionPlans]: "image-production-engine",
};
