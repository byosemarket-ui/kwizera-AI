/**
 * KWIZERA AI STUDIO — Image Editing, Inpainting & Outpainting Engine types (Step 9F)
 */

export enum ImageEditGenPlatform {
  Website = "website",
  Mobile = "mobile",
  Instagram = "instagram",
  Facebook = "facebook",
  TikTok = "tiktok",
  LinkedIn = "linkedin",
  Print = "print",
  Billboard = "billboard",
}

export enum ImageEditGenInputType {
  SourceImage = "source-image",
  EditingPrompt = "editing-prompt",
  ProductInformation = "product-information",
  BrandGuidelines = "brand-guidelines",
  Campaign = "campaign",
  StyleReferences = "style-references",
  Mask = "mask",
  KnowledgeRecord = "knowledge-record",
}

export enum ImageEditOperationType {
  ObjectRemoval = "object-removal",
  ObjectAddition = "object-addition",
  ObjectReplacement = "object-replacement",
  ColorEditing = "color-editing",
  LightingEditing = "lighting-editing",
  ShadowEditing = "shadow-editing",
  ReflectionEditing = "reflection-editing",
  BackgroundEditing = "background-editing",
  SkinRetouchPlanning = "skin-retouch-planning",
  ProductCleanup = "product-cleanup",
}

export enum ImageEditInpaintingType {
  HoleFilling = "hole-filling",
  MissingAreaReconstruction = "missing-area-reconstruction",
  ObjectReconstruction = "object-reconstruction",
  TextureReconstruction = "texture-reconstruction",
  PatternReconstruction = "pattern-reconstruction",
  DetailRecovery = "detail-recovery",
}

export enum ImageEditOutpaintingType {
  CanvasExpansion = "canvas-expansion",
  SceneExtension = "scene-extension",
  BackgroundExtension = "background-extension",
  EnvironmentExtension = "environment-extension",
  AspectRatioExpansion = "aspect-ratio-expansion",
  PrintExpansion = "print-expansion",
}

export enum ImageEditMaskType {
  EditableMask = "editable-mask",
  ObjectMask = "object-mask",
  SubjectMask = "subject-mask",
  BackgroundMask = "background-mask",
  LayerMask = "layer-mask",
  ProtectedRegion = "protected-region",
}

export enum ImageEditIdentityTarget {
  HumanIdentity = "human-identity",
  ProductIdentity = "product-identity",
  LogoIntegrity = "logo-integrity",
  PackagingIntegrity = "packaging-integrity",
  BrandColors = "brand-colors",
  BrandElements = "brand-elements",
}

export interface ImageEditingPlanProfile {
  imageEditingPlanId: string;
  sourceImageId: string;
  editedImageId: string;
  promptId: string;
  projectId: string;
  productId: string;
  brandId: string;
  campaignId: string;
  platform: ImageEditGenPlatform;
  primaryOperation: ImageEditOperationType;
  inpaintingType?: ImageEditInpaintingType;
  outpaintingType?: ImageEditOutpaintingType;
  version: number;
  language: string;
}

export interface ImageAnalysisPlan {
  subject: string;
  objects: string[];
  background: string;
  composition: string;
  perspective: string;
  lighting: string;
  shadows: string;
  reflections: string;
  imageQuality: string;
  resolution: string;
}

export interface ImageEditOperationPlan {
  operations: ImageEditOperationType[];
  operationPrompts: Record<string, string>;
  executionOrder: string[];
  nonDestructiveNotes: string[];
}

export interface InpaintingPlan {
  inpaintingType: ImageEditInpaintingType;
  targetRegions: string[];
  reconstructionStrategy: string;
  textureNotes: string[];
  detailRecoveryNotes: string[];
}

export interface OutpaintingPlan {
  outpaintingType: ImageEditOutpaintingType;
  expansionDirection: string;
  expansionRatio: string;
  sceneExtensionNotes: string[];
  environmentNotes: string[];
}

export interface MaskManagementPlan {
  masks: Array<{
    maskId: string;
    maskType: ImageEditMaskType;
    label: string;
    editable: boolean;
    protected: boolean;
  }>;
  protectedRegions: string[];
  layerNotes: string[];
}

export interface IdentityPreservationPlan {
  targets: ImageEditIdentityTarget[];
  identityLock: boolean;
  productLock: boolean;
  logoLock: boolean;
  brandColorLock: boolean;
  notes: string[];
}

export interface NonDestructiveEditingPlan {
  originalPreserved: boolean;
  layerEditingEnabled: boolean;
  undoStackDepth: number;
  redoStackDepth: number;
  rollbackSupported: boolean;
  versionHistory: Array<{ version: number; timestamp: string; summary: string }>;
}

export interface ImageEditQualityImprovementPlan {
  edgeQuality: string;
  textureQuality: string;
  fineDetails: string;
  noiseReduction: string;
  artifactPrevention: string;
  sharpnessPlanning: string;
}

export interface ImageEditPlatformOptimization {
  platform: ImageEditGenPlatform;
  aspectRatio: string;
  resolution: string;
  optimizationNotes: string[];
}

export interface ProductionImageEditingInstructions {
  renderNotes: string[];
  maskGuidance: string[];
  layerGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
}

export interface ImageEditingScores {
  editingQualityScore: number;
  identityPreservationScore: number;
  reconstructionScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface ImageEditingRelationships {
  sourceImages: string[];
  editedImages: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  prompts: string[];
  masks: string[];
  knowledgeRecords: string[];
  backgroundPlans: string[];
  productImagePlans: string[];
}

export interface ImageEditingInput {
  sourceImageId?: string;
  editingPrompt?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: ImageEditGenPlatform;
  language?: string;
  primaryOperation?: ImageEditOperationType;
  operations?: ImageEditOperationType[];
  inpaintingType?: ImageEditInpaintingType;
  outpaintingType?: ImageEditOutpaintingType;
  maskIds?: string[];
  styleReferenceIds?: string[];
  knowledgeRecordIds?: string[];
  productImagePlanId?: string;
  backgroundPlanId?: string;
  generateInpaintingPlan?: boolean;
  generateOutpaintingPlan?: boolean;
  generatePlatformOptimizations?: boolean;
  inputTypes?: ImageEditGenInputType[];
}

export interface ImageEditingRecord {
  imageEditingPlanId: string;
  profile: ImageEditingPlanProfile;
  imageAnalysis: ImageAnalysisPlan;
  editingOperations: ImageEditOperationPlan;
  inpaintingPlan: InpaintingPlan;
  outpaintingPlan: OutpaintingPlan;
  maskManagement: MaskManagementPlan;
  identityPreservation: IdentityPreservationPlan;
  nonDestructiveEditing: NonDestructiveEditingPlan;
  qualityImprovement: ImageEditQualityImprovementPlan;
  platformOptimizations: ImageEditPlatformOptimization[];
  productionInstructions: ProductionImageEditingInstructions;
  blueprintId?: string;
  scores: ImageEditingScores;
  relationships: ImageEditingRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface ImageEditingResult {
  success: boolean;
  record?: ImageEditingRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ImageEditingSearchQuery {
  imageEditingPlanId?: string;
  sourceImageId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: ImageEditGenPlatform;
  primaryOperation?: ImageEditOperationType;
  inpaintingType?: ImageEditInpaintingType;
  outpaintingType?: ImageEditOutpaintingType;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface ImageEditingEngineStatusReport {
  engineStatus: string;
  imageAnalysisStatus: string;
  editingOperationsStatus: string;
  inpaintingStatus: string;
  outpaintingStatus: string;
  maskManagementStatus: string;
  imageEditingPlansGenerated: number;
  averageEditingQualityScore: number;
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

export class ImageEditingEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageEditingEngineError";
  }
}

export const ALL_IMAGE_EDIT_OPERATIONS: ImageEditOperationType[] = [
  ImageEditOperationType.ObjectRemoval,
  ImageEditOperationType.ObjectAddition,
  ImageEditOperationType.ObjectReplacement,
  ImageEditOperationType.ColorEditing,
  ImageEditOperationType.LightingEditing,
  ImageEditOperationType.ShadowEditing,
  ImageEditOperationType.ReflectionEditing,
  ImageEditOperationType.BackgroundEditing,
  ImageEditOperationType.SkinRetouchPlanning,
  ImageEditOperationType.ProductCleanup,
];

export const ALL_IMAGE_EDIT_INPAINTING_TYPES: ImageEditInpaintingType[] = [
  ImageEditInpaintingType.HoleFilling,
  ImageEditInpaintingType.MissingAreaReconstruction,
  ImageEditInpaintingType.ObjectReconstruction,
  ImageEditInpaintingType.TextureReconstruction,
  ImageEditInpaintingType.PatternReconstruction,
  ImageEditInpaintingType.DetailRecovery,
];

export const ALL_IMAGE_EDIT_OUTPAINTING_TYPES: ImageEditOutpaintingType[] = [
  ImageEditOutpaintingType.CanvasExpansion,
  ImageEditOutpaintingType.SceneExtension,
  ImageEditOutpaintingType.BackgroundExtension,
  ImageEditOutpaintingType.EnvironmentExtension,
  ImageEditOutpaintingType.AspectRatioExpansion,
  ImageEditOutpaintingType.PrintExpansion,
];

export const ALL_IMAGE_EDIT_MASK_TYPES: ImageEditMaskType[] = [
  ImageEditMaskType.EditableMask,
  ImageEditMaskType.ObjectMask,
  ImageEditMaskType.SubjectMask,
  ImageEditMaskType.BackgroundMask,
  ImageEditMaskType.LayerMask,
  ImageEditMaskType.ProtectedRegion,
];

export const ALL_IMAGE_EDIT_IDENTITY_TARGETS: ImageEditIdentityTarget[] = [
  ImageEditIdentityTarget.HumanIdentity,
  ImageEditIdentityTarget.ProductIdentity,
  ImageEditIdentityTarget.LogoIntegrity,
  ImageEditIdentityTarget.PackagingIntegrity,
  ImageEditIdentityTarget.BrandColors,
  ImageEditIdentityTarget.BrandElements,
];

export const ALL_IMAGE_EDIT_GEN_PLATFORMS: ImageEditGenPlatform[] = [
  ImageEditGenPlatform.Website,
  ImageEditGenPlatform.Mobile,
  ImageEditGenPlatform.Instagram,
  ImageEditGenPlatform.Facebook,
  ImageEditGenPlatform.TikTok,
  ImageEditGenPlatform.LinkedIn,
  ImageEditGenPlatform.Print,
  ImageEditGenPlatform.Billboard,
];

export const IMAGE_EDIT_PLATFORM_CONFIG: Record<
  ImageEditGenPlatform,
  { aspectRatio: string; resolution: string; width: number; height: number }
> = {
  [ImageEditGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
  [ImageEditGenPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
  [ImageEditGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
  [ImageEditGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
  [ImageEditGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
  [ImageEditGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
  [ImageEditGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
  [ImageEditGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
