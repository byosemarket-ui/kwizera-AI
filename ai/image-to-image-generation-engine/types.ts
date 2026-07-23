/**
 * KWIZERA AI STUDIO — Image-to-Image Generation Engine types (Step 9C)
 */

export enum ImageToImagePlatform {
  Website = "website",
  Instagram = "instagram",
  Facebook = "facebook",
  TikTok = "tiktok",
  LinkedIn = "linkedin",
  Print = "print",
  Billboard = "billboard",
  Packaging = "packaging",
}

export enum ImageToImageInputType {
  SourceImage = "source-image",
  TransformationPrompt = "transformation-prompt",
  ProductInformation = "product-information",
  BrandGuidelines = "brand-guidelines",
  StyleReferences = "style-references",
  KnowledgeRecord = "knowledge-record",
}

export enum TransformationType {
  StyleTransfer = "style-transfer",
  BackgroundReplacement = "background-replacement",
  ColorModification = "color-modification",
  LightingAdjustment = "lighting-adjustment",
  CompositionAdjustment = "composition-adjustment",
  ObjectReplacement = "object-replacement",
  ObjectRemoval = "object-removal",
  SubjectEnhancement = "subject-enhancement",
  ResolutionPlanning = "resolution-planning",
}

export enum PreservationRule {
  PreserveIdentity = "preserve-identity",
  PreserveProductShape = "preserve-product-shape",
  PreserveLogo = "preserve-logo",
  PreserveBrandColors = "preserve-brand-colors",
  PreserveComposition = "preserve-composition",
  PreserveUserSelectedAreas = "preserve-user-selected-areas",
}

export enum MaskType {
  EditableMask = "editable-mask",
  ProtectedMask = "protected-mask",
  RegionSelection = "region-selection",
  ForegroundMask = "foreground-mask",
  BackgroundMask = "background-mask",
  ObjectMask = "object-mask",
}

export enum ImageTransformationStyle {
  Photorealistic = "photorealistic",
  Commercial = "commercial",
  Luxury = "luxury",
  Corporate = "corporate",
  Cartoon = "cartoon",
  Illustration = "illustration",
  Watercolor = "watercolor",
  OilPainting = "oil-painting",
  PencilSketch = "pencil-sketch",
  ThreeDStyle = "3d-style",
  ProductPhotography = "product-photography",
}

export enum ImageTransformationBackgroundType {
  White = "white-background",
  Transparent = "transparent-background",
  Studio = "studio-background",
  Lifestyle = "lifestyle-background",
  Outdoor = "outdoor-background",
  Custom = "custom-background",
}

export enum ImageTransformationVariationType {
  VariationA = "variation-a",
  VariationB = "variation-b",
  VariationC = "variation-c",
  StyleVariation = "style-variation",
  BackgroundVariation = "background-variation",
  ColorVariation = "color-variation",
}

export enum SourceImageCategory {
  Product = "product",
  Portrait = "portrait",
  Lifestyle = "lifestyle",
  Packaging = "packaging",
  Brand = "brand",
}

export interface SourceImageMetadata {
  imageId: string;
  category: SourceImageCategory;
  subject: string;
  resolution: string;
  width: number;
  height: number;
  format: string;
  qualityScore: number;
  objects?: string[];
  background?: string;
}

export interface TransformationPlanProfile {
  transformationPlanId: string;
  sourceImageId: string;
  generatedImageId: string;
  promptId: string;
  projectId: string;
  productId: string;
  brandId: string;
  platform: ImageToImagePlatform;
  targetStyle: ImageTransformationStyle;
  targetBackground: ImageTransformationBackgroundType;
  version: number;
  language: string;
}

export interface SourceImageAnalysis {
  subject: string;
  objects: string[];
  background: string;
  composition: string;
  lighting: string;
  colors: string[];
  cameraPerspective: string;
  imageQuality: string;
  resolution: string;
  metadata: Record<string, string | number>;
}

export interface TransformationStep {
  type: TransformationType;
  description: string;
  priority: number;
  preserveElements: string[];
}

export interface TransformationPlan {
  steps: TransformationStep[];
  targetStyle: ImageTransformationStyle;
  targetBackground: ImageTransformationBackgroundType;
  transformationPrompt: string;
  visualConsistencyNotes: string[];
}

export interface PreservationPlan {
  rules: PreservationRule[];
  protectedRegions: string[];
  identityLock: boolean;
  brandColorLock: boolean;
  compositionLock: boolean;
  notes: string[];
}

export interface MaskDefinition {
  maskId: string;
  maskType: MaskType;
  label: string;
  region: string;
  editable: boolean;
  protected: boolean;
}

export interface MaskPlan {
  masks: MaskDefinition[];
  foregroundMaskId: string;
  backgroundMaskId: string;
  objectMaskIds: string[];
  editableRegions: string[];
  protectedRegions: string[];
}

export interface BackgroundPlan {
  backgroundType: ImageTransformationBackgroundType;
  description: string;
  replacementStrategy: string;
  lightingAdaptation: string;
  colorHarmony: string;
}

export interface PlatformTransformationOptimization {
  platform: ImageToImagePlatform;
  aspectRatio: string;
  resolution: string;
  safeZones: string[];
  formatNotes: string[];
  optimizationNotes: string[];
}

export interface TransformationVariation {
  variationId: string;
  variationType: ImageTransformationVariationType;
  label: string;
  styleAdjustment: string;
  backgroundAdjustment: string;
  colorAdjustment: string;
}

export interface ProductionTransformationInstructions {
  renderNotes: string[];
  maskGuidance: string[];
  layerGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
}

export interface ImageToImageScores {
  transformationQualityScore: number;
  identityPreservationScore: number;
  styleConsistencyScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface ImageToImageRelationships {
  sourceImages: string[];
  generatedImages: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  prompts: string[];
  knowledgeRecords: string[];
  textToImagePlans: string[];
}

export interface ImageToImageGenerationInput {
  sourceImageId?: string;
  sourceImageMetadata?: SourceImageMetadata;
  transformationPrompt?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: ImageToImagePlatform;
  language?: string;
  targetStyle?: ImageTransformationStyle;
  targetBackground?: ImageTransformationBackgroundType;
  transformationTypes?: TransformationType[];
  preservationRules?: PreservationRule[];
  styleReferenceIds?: string[];
  knowledgeRecordIds?: string[];
  textToImagePlanId?: string;
  generateVariations?: boolean;
  generatePlatformOptimizations?: boolean;
  inputTypes?: ImageToImageInputType[];
}

export interface ImageToImageGenerationRecord {
  transformationPlanId: string;
  profile: TransformationPlanProfile;
  sourceAnalysis: SourceImageAnalysis;
  transformationPlan: TransformationPlan;
  preservationPlan: PreservationPlan;
  maskPlan: MaskPlan;
  backgroundPlan: BackgroundPlan;
  platformOptimizations: PlatformTransformationOptimization[];
  variations: TransformationVariation[];
  productionInstructions: ProductionTransformationInstructions;
  blueprintId?: string;
  scores: ImageToImageScores;
  relationships: ImageToImageRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface ImageToImageGenerationResult {
  success: boolean;
  record?: ImageToImageGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ImageToImageSearchQuery {
  transformationPlanId?: string;
  sourceImageId?: string;
  generatedImageId?: string;
  productId?: string;
  brandId?: string;
  platform?: ImageToImagePlatform;
  style?: ImageTransformationStyle;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface ImageToImageGenerationEngineStatusReport {
  engineStatus: string;
  sourceAnalysisStatus: string;
  transformationPlanningStatus: string;
  maskPlanningStatus: string;
  preservationStatus: string;
  platformOptimizationStatus: string;
  transformationPlansGenerated: number;
  averageTransformationQualityScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averageAnalysisMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ImageToImageGenerationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageToImageGenerationEngineError";
  }
}

export const ALL_IMAGE_TO_IMAGE_PLATFORMS: ImageToImagePlatform[] = [
  ImageToImagePlatform.Website,
  ImageToImagePlatform.Instagram,
  ImageToImagePlatform.Facebook,
  ImageToImagePlatform.TikTok,
  ImageToImagePlatform.LinkedIn,
  ImageToImagePlatform.Print,
  ImageToImagePlatform.Billboard,
  ImageToImagePlatform.Packaging,
];

export const ALL_TRANSFORMATION_TYPES: TransformationType[] = [
  TransformationType.StyleTransfer,
  TransformationType.BackgroundReplacement,
  TransformationType.ColorModification,
  TransformationType.LightingAdjustment,
  TransformationType.CompositionAdjustment,
  TransformationType.ObjectReplacement,
  TransformationType.ObjectRemoval,
  TransformationType.SubjectEnhancement,
  TransformationType.ResolutionPlanning,
];

export const ALL_PRESERVATION_RULES: PreservationRule[] = [
  PreservationRule.PreserveIdentity,
  PreservationRule.PreserveProductShape,
  PreservationRule.PreserveLogo,
  PreservationRule.PreserveBrandColors,
  PreservationRule.PreserveComposition,
  PreservationRule.PreserveUserSelectedAreas,
];

export const PLATFORM_CONFIG: Record<
  ImageToImagePlatform,
  { aspectRatio: string; resolution: string; width: number; height: number }
> = {
  [ImageToImagePlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
  [ImageToImagePlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
  [ImageToImagePlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
  [ImageToImagePlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
  [ImageToImagePlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
  [ImageToImagePlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
  [ImageToImagePlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
  [ImageToImagePlatform.Packaging]: { aspectRatio: "4:5", resolution: "2400x3000", width: 2400, height: 3000 },
};
