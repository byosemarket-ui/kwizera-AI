/**
 * KWIZERA AI STUDIO — Image Quality Validation Engine types (Step 9L)
 */

export enum QualityValidationPlatform {
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

export enum ImageQualityCheck {
  ImageResolution = "image-resolution",
  Sharpness = "sharpness",
  Noise = "noise",
  CompressionArtifacts = "compression-artifacts",
  ColorAccuracy = "color-accuracy",
  WhiteBalance = "white-balance",
  Exposure = "exposure",
  Contrast = "contrast",
  DynamicRange = "dynamic-range",
  TextureQuality = "texture-quality",
}

export enum QualityLayerCheck {
  LayerStructure = "layer-structure",
  LayerOrder = "layer-order",
  LayerGroups = "layer-groups",
  BlendModes = "blend-modes",
  Opacity = "opacity",
  ClippingMasks = "clipping-masks",
}

export enum QualityMaskType {
  SubjectMask = "subject-mask",
  ObjectMask = "object-mask",
  BackgroundMask = "background-mask",
  LayerMask = "layer-mask",
  AlphaMask = "alpha-mask",
  EditableRegion = "editable-region",
}

export enum TypographyCheck {
  FontUsage = "font-usage",
  FontConsistency = "font-consistency",
  TypographyHierarchy = "typography-hierarchy",
  Spacing = "spacing",
  Alignment = "alignment",
  Readability = "readability",
  Spelling = "spelling",
}

export enum BrandValidationCheck {
  LogoUsage = "logo-usage",
  BrandColors = "brand-colors",
  Typography = "typography",
  BrandAssets = "brand-assets",
  DesignConsistency = "design-consistency",
  CampaignConsistency = "campaign-consistency",
}

export enum PrintValidationCheck {
  Dpi = "dpi",
  Resolution = "resolution",
  Cmyk = "cmyk",
  Rgb = "rgb",
  IccProfiles = "icc-profiles",
  BleedPreparation = "bleed-preparation",
  SafeMargins = "safe-margins",
  CropMarks = "crop-marks",
}

export enum TechnicalValidationCheck {
  FileFormat = "file-format",
  ColorSpace = "color-space",
  BitDepth = "bit-depth",
  Transparency = "transparency",
  Metadata = "metadata",
  Compression = "compression",
  AlphaChannel = "alpha-channel",
}

export enum QualityIssueSeverity {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum QualityIssueCategory {
  MissingAsset = "missing-asset",
  BrokenLayer = "broken-layer",
  BrokenMask = "broken-mask",
  Typography = "typography",
  Color = "color",
  Branding = "branding",
  RenderingRisk = "rendering-risk",
}

export interface QualityValidationProfile {
  qualityValidationId: string;
  projectId: string;
  productionId: string;
  renderPlanId: string;
  imagePlanId: string;
  productId: string;
  brandId: string;
  platform: QualityValidationPlatform;
  validationVersion: number;
}

export interface ImageQualityValidationEntry {
  check: ImageQualityCheck;
  validated: boolean;
  score: number;
  notes: string[];
}

export interface QualityLayerValidationEntry {
  check: QualityLayerCheck;
  validated: boolean;
  notes: string[];
}

export interface QualityMaskValidationEntry {
  maskType: QualityMaskType;
  validated: boolean;
  maskId: string;
  notes: string[];
}

export interface TypographyValidationEntry {
  check: TypographyCheck;
  validated: boolean;
  notes: string[];
}

export interface BrandValidationEntry {
  check: BrandValidationCheck;
  validated: boolean;
  notes: string[];
}

export interface PrintValidationEntry {
  check: PrintValidationCheck;
  validated: boolean;
  notes: string[];
}

export interface PlatformValidationEntry {
  platform: QualityValidationPlatform;
  validated: boolean;
  ready: boolean;
  notes: string[];
}

export interface TechnicalValidationEntry {
  check: TechnicalValidationCheck;
  validated: boolean;
  notes: string[];
}

export interface QualityIssue {
  issueId: string;
  category: QualityIssueCategory;
  severity: QualityIssueSeverity;
  message: string;
  repaired: boolean;
  repairNotes?: string[];
}

export interface QualityValidationScores {
  overallQualityScore: number;
  visualQualityScore: number;
  colorAccuracyScore: number;
  layerIntegrityScore: number;
  typographyScore: number;
  brandConsistencyScore: number;
  printReadinessScore: number;
  platformCompatibilityScore: number;
  aiConfidenceScore: number;
}

export interface QualityValidationRelationships {
  imagePlans: string[];
  productionPlans: string[];
  renderPlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  templates: string[];
  knowledgeRecords: string[];
}

export interface ImageQualityValidationInput {
  productId?: string;
  projectId?: string;
  productionId?: string;
  renderPlanId?: string;
  imagePlanId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: QualityValidationPlatform;
  templateIds?: string[];
  knowledgeRecordIds?: string[];
  sourceImageId?: string;
  generatedImageId?: string;
  validatePrint?: boolean;
  validatePlatform?: boolean;
  autoRepair?: boolean;
}

export interface ImageQualityValidationRecord {
  qualityValidationId: string;
  profile: QualityValidationProfile;
  imageQuality: ImageQualityValidationEntry[];
  layerValidation: QualityLayerValidationEntry[];
  maskValidation: QualityMaskValidationEntry[];
  typographyValidation: TypographyValidationEntry[];
  brandValidation: BrandValidationEntry[];
  printValidation: PrintValidationEntry[];
  platformValidation: PlatformValidationEntry[];
  technicalValidation: TechnicalValidationEntry[];
  issues: QualityIssue[];
  repairsApplied: string[];
  blueprintId?: string;
  scores: QualityValidationScores;
  relationships: QualityValidationRelationships;
  recommendations: string[];
  validated: boolean;
  approved: boolean;
  productionReady: boolean;
  renderReady: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface ImageQualityValidationResult {
  success: boolean;
  record?: ImageQualityValidationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ImageQualityValidationSearchQuery {
  qualityValidationId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: QualityValidationPlatform;
  minQualityScore?: number;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface ImageQualityValidationEngineStatusReport {
  engineStatus: string;
  imageQualityStatus: string;
  layerValidationStatus: string;
  brandValidationStatus: string;
  validationsPerformed: number;
  averageOverallQualityScore: number;
  averageApprovalRate: number;
  performance: {
    averageValidationMs: number;
    averageSearchMs: number;
    averageRepairMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ImageQualityValidationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ImageQualityValidationEngineError";
  }
}

export const ALL_QUALITY_VALIDATION_PLATFORMS: QualityValidationPlatform[] = [
  QualityValidationPlatform.Website,
  QualityValidationPlatform.Mobile,
  QualityValidationPlatform.Instagram,
  QualityValidationPlatform.Facebook,
  QualityValidationPlatform.TikTok,
  QualityValidationPlatform.LinkedIn,
  QualityValidationPlatform.Print,
  QualityValidationPlatform.Packaging,
  QualityValidationPlatform.Billboard,
];

export const ALL_IMAGE_QUALITY_CHECKS: ImageQualityCheck[] = [
  ImageQualityCheck.ImageResolution,
  ImageQualityCheck.Sharpness,
  ImageQualityCheck.Noise,
  ImageQualityCheck.CompressionArtifacts,
  ImageQualityCheck.ColorAccuracy,
  ImageQualityCheck.WhiteBalance,
  ImageQualityCheck.Exposure,
  ImageQualityCheck.Contrast,
  ImageQualityCheck.DynamicRange,
  ImageQualityCheck.TextureQuality,
];

export const ALL_QUALITY_LAYER_CHECKS: QualityLayerCheck[] = [
  QualityLayerCheck.LayerStructure,
  QualityLayerCheck.LayerOrder,
  QualityLayerCheck.LayerGroups,
  QualityLayerCheck.BlendModes,
  QualityLayerCheck.Opacity,
  QualityLayerCheck.ClippingMasks,
];

export const ALL_QUALITY_MASK_TYPES: QualityMaskType[] = [
  QualityMaskType.SubjectMask,
  QualityMaskType.ObjectMask,
  QualityMaskType.BackgroundMask,
  QualityMaskType.LayerMask,
  QualityMaskType.AlphaMask,
  QualityMaskType.EditableRegion,
];

export const ALL_TYPOGRAPHY_CHECKS: TypographyCheck[] = [
  TypographyCheck.FontUsage,
  TypographyCheck.FontConsistency,
  TypographyCheck.TypographyHierarchy,
  TypographyCheck.Spacing,
  TypographyCheck.Alignment,
  TypographyCheck.Readability,
  TypographyCheck.Spelling,
];

export const ALL_BRAND_VALIDATION_CHECKS: BrandValidationCheck[] = [
  BrandValidationCheck.LogoUsage,
  BrandValidationCheck.BrandColors,
  BrandValidationCheck.Typography,
  BrandValidationCheck.BrandAssets,
  BrandValidationCheck.DesignConsistency,
  BrandValidationCheck.CampaignConsistency,
];

export const ALL_PRINT_VALIDATION_CHECKS: PrintValidationCheck[] = [
  PrintValidationCheck.Dpi,
  PrintValidationCheck.Resolution,
  PrintValidationCheck.Cmyk,
  PrintValidationCheck.Rgb,
  PrintValidationCheck.IccProfiles,
  PrintValidationCheck.BleedPreparation,
  PrintValidationCheck.SafeMargins,
  PrintValidationCheck.CropMarks,
];

export const ALL_TECHNICAL_VALIDATION_CHECKS: TechnicalValidationCheck[] = [
  TechnicalValidationCheck.FileFormat,
  TechnicalValidationCheck.ColorSpace,
  TechnicalValidationCheck.BitDepth,
  TechnicalValidationCheck.Transparency,
  TechnicalValidationCheck.Metadata,
  TechnicalValidationCheck.Compression,
  TechnicalValidationCheck.AlphaChannel,
];

export const QUALITY_PLATFORM_CONFIG: Record<
  QualityValidationPlatform,
  { resolution: string; dpi: number; aspectRatio: string }
> = {
  [QualityValidationPlatform.Website]: { resolution: "1920x1080", dpi: 72, aspectRatio: "16:9" },
  [QualityValidationPlatform.Mobile]: { resolution: "1080x1920", dpi: 72, aspectRatio: "9:16" },
  [QualityValidationPlatform.Instagram]: { resolution: "1080x1080", dpi: 72, aspectRatio: "1:1" },
  [QualityValidationPlatform.Facebook]: { resolution: "1200x628", dpi: 72, aspectRatio: "1.91:1" },
  [QualityValidationPlatform.TikTok]: { resolution: "1080x1920", dpi: 72, aspectRatio: "9:16" },
  [QualityValidationPlatform.LinkedIn]: { resolution: "1200x627", dpi: 72, aspectRatio: "1.91:1" },
  [QualityValidationPlatform.Print]: { resolution: "3000x2000", dpi: 300, aspectRatio: "3:2" },
  [QualityValidationPlatform.Packaging]: { resolution: "2048x2048", dpi: 300, aspectRatio: "1:1" },
  [QualityValidationPlatform.Billboard]: { resolution: "6000x2000", dpi: 150, aspectRatio: "3:1" },
};
