/**
 * KWIZERA AI STUDIO — Multi-Style Image Generation Engine types (Step 9I)
 */

export enum MultiStyleGenPlatform {
  Website = "website",
  Mobile = "mobile",
  Instagram = "instagram",
  Facebook = "facebook",
  TikTok = "tiktok",
  LinkedIn = "linkedin",
  Print = "print",
  Catalogue = "catalogue",
  Billboard = "billboard",
}

export enum MultiStyleGenInputType {
  Prompt = "prompt",
  SourceImage = "source-image",
  ProductImage = "product-image",
  BrandGuidelines = "brand-guidelines",
  Campaign = "campaign",
  StyleReference = "style-reference",
  Template = "template",
  KnowledgeRecord = "knowledge-record",
}

export enum MultiStyleImageCategory {
  Photorealistic = "photorealistic",
  Commercial = "commercial",
  Luxury = "luxury",
  Corporate = "corporate",
  StudioPhotography = "studio-photography",
  ProductPhotography = "product-photography",
  Lifestyle = "lifestyle",
  Editorial = "editorial",
  Fashion = "fashion",
  FoodPhotography = "food-photography",
  RealEstate = "real-estate",
  Architecture = "architecture",
  Medical = "medical",
  Technology = "technology",
  Cartoon = "cartoon",
  Illustration = "illustration",
  Watercolor = "watercolor",
  OilPainting = "oil-painting",
  PencilSketch = "pencil-sketch",
  InkDrawing = "ink-drawing",
  LowPoly = "low-poly",
  Render3D = "3d-render",
  ClayRender = "clay-render",
  Isometric = "isometric",
  PixelArt = "pixel-art",
  Anime = "anime",
  Comic = "comic",
  Minimal = "minimal",
  FlatDesign = "flat-design",
  Abstract = "abstract",
  Vintage = "vintage",
  Futuristic = "futuristic",
}

export enum MultiStyleVariationType {
  StyleVersionA = "style-version-a",
  StyleVersionB = "style-version-b",
  StyleVersionC = "style-version-c",
  PremiumVersion = "premium-version",
  CommercialVersion = "commercial-version",
  SocialMediaVersion = "social-media-version",
  PrintVersion = "print-version",
}

export enum MultiStyleIdentityTarget {
  HumanIdentity = "human-identity",
  ProductIdentity = "product-identity",
  LogoIntegrity = "logo-integrity",
  PackagingIntegrity = "packaging-integrity",
  BrandColors = "brand-colors",
  Typography = "typography",
  VisualIdentity = "visual-identity",
}

export interface MultiStylePlanProfile {
  stylePlanId: string;
  projectId: string;
  productId: string;
  brandId: string;
  campaignId: string;
  platform: MultiStyleGenPlatform;
  styleCategory: MultiStyleImageCategory;
  promptId: string;
  sourceImageId: string;
  generatedStyleImageId: string;
  version: number;
  language: string;
}

export interface StyleTransformationPlan {
  styleMapping: string;
  texturePlanning: string;
  colorAdaptation: string;
  lightingAdaptation: string;
  compositionAdaptation: string;
  detailAdaptation: string;
  materialAdaptation: string;
}

export interface MultiStyleVariationPlan {
  variations: Array<{
    variationId: string;
    variationType: MultiStyleVariationType;
    styleCategory: MultiStyleImageCategory;
    label: string;
    description: string;
  }>;
}

export interface MultiStyleIdentityPreservationPlan {
  targets: MultiStyleIdentityTarget[];
  identityLock: boolean;
  productLock: boolean;
  logoLock: boolean;
  brandColorLock: boolean;
  notes: string[];
}

export interface MultiStylePlatformOptimization {
  platform: MultiStyleGenPlatform;
  aspectRatio: string;
  resolution: string;
  styleNotes: string[];
}

export interface ProductionMultiStyleInstructions {
  renderNotes: string[];
  styleGuidance: string[];
  preservationGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
}

export interface MultiStyleImageScores {
  styleQualityScore: number;
  styleAccuracyScore: number;
  identityPreservationScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface MultiStyleImageRelationships {
  products: string[];
  brands: string[];
  campaigns: string[];
  templates: string[];
  prompts: string[];
  sourceImages: string[];
  generatedImages: string[];
  knowledgeRecords: string[];
  productImagePlans: string[];
  brandingPlans: string[];
}

export interface MultiStyleImageInput {
  prompt?: string;
  sourceImageId?: string;
  productImageId?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: MultiStyleGenPlatform;
  styleCategory?: MultiStyleImageCategory;
  language?: string;
  styleReferenceIds?: string[];
  templateIds?: string[];
  knowledgeRecordIds?: string[];
  productImagePlanId?: string;
  brandingPlanId?: string;
  generateVariations?: boolean;
  generatePlatformOptimizations?: boolean;
  inputTypes?: MultiStyleGenInputType[];
}

export interface MultiStyleImageRecord {
  stylePlanId: string;
  profile: MultiStylePlanProfile;
  styleTransformation: StyleTransformationPlan;
  styleVariations: MultiStyleVariationPlan;
  identityPreservation: MultiStyleIdentityPreservationPlan;
  platformOptimizations: MultiStylePlatformOptimization[];
  productionInstructions: ProductionMultiStyleInstructions;
  blueprintId?: string;
  scores: MultiStyleImageScores;
  relationships: MultiStyleImageRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface MultiStyleImageResult {
  success: boolean;
  record?: MultiStyleImageRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface MultiStyleImageSearchQuery {
  stylePlanId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: MultiStyleGenPlatform;
  styleCategory?: MultiStyleImageCategory;
  templateId?: string;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface MultiStyleImageEngineStatusReport {
  engineStatus: string;
  styleLibraryStatus: string;
  styleTransformationStatus: string;
  identityPreservationStatus: string;
  variationStatus: string;
  stylePlansGenerated: number;
  averageStyleQualityScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averagePlanningMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class MultiStyleImageEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MultiStyleImageEngineError";
  }
}

export const ALL_MULTI_STYLE_IMAGE_CATEGORIES: MultiStyleImageCategory[] = [
  MultiStyleImageCategory.Photorealistic,
  MultiStyleImageCategory.Commercial,
  MultiStyleImageCategory.Luxury,
  MultiStyleImageCategory.Corporate,
  MultiStyleImageCategory.StudioPhotography,
  MultiStyleImageCategory.ProductPhotography,
  MultiStyleImageCategory.Lifestyle,
  MultiStyleImageCategory.Editorial,
  MultiStyleImageCategory.Fashion,
  MultiStyleImageCategory.FoodPhotography,
  MultiStyleImageCategory.RealEstate,
  MultiStyleImageCategory.Architecture,
  MultiStyleImageCategory.Medical,
  MultiStyleImageCategory.Technology,
  MultiStyleImageCategory.Cartoon,
  MultiStyleImageCategory.Illustration,
  MultiStyleImageCategory.Watercolor,
  MultiStyleImageCategory.OilPainting,
  MultiStyleImageCategory.PencilSketch,
  MultiStyleImageCategory.InkDrawing,
  MultiStyleImageCategory.LowPoly,
  MultiStyleImageCategory.Render3D,
  MultiStyleImageCategory.ClayRender,
  MultiStyleImageCategory.Isometric,
  MultiStyleImageCategory.PixelArt,
  MultiStyleImageCategory.Anime,
  MultiStyleImageCategory.Comic,
  MultiStyleImageCategory.Minimal,
  MultiStyleImageCategory.FlatDesign,
  MultiStyleImageCategory.Abstract,
  MultiStyleImageCategory.Vintage,
  MultiStyleImageCategory.Futuristic,
];

export const ALL_MULTI_STYLE_VARIATION_TYPES: MultiStyleVariationType[] = [
  MultiStyleVariationType.StyleVersionA,
  MultiStyleVariationType.StyleVersionB,
  MultiStyleVariationType.StyleVersionC,
  MultiStyleVariationType.PremiumVersion,
  MultiStyleVariationType.CommercialVersion,
  MultiStyleVariationType.SocialMediaVersion,
  MultiStyleVariationType.PrintVersion,
];

export const ALL_MULTI_STYLE_IDENTITY_TARGETS: MultiStyleIdentityTarget[] = [
  MultiStyleIdentityTarget.HumanIdentity,
  MultiStyleIdentityTarget.ProductIdentity,
  MultiStyleIdentityTarget.LogoIntegrity,
  MultiStyleIdentityTarget.PackagingIntegrity,
  MultiStyleIdentityTarget.BrandColors,
  MultiStyleIdentityTarget.Typography,
  MultiStyleIdentityTarget.VisualIdentity,
];

export const ALL_MULTI_STYLE_GEN_PLATFORMS: MultiStyleGenPlatform[] = [
  MultiStyleGenPlatform.Website,
  MultiStyleGenPlatform.Mobile,
  MultiStyleGenPlatform.Instagram,
  MultiStyleGenPlatform.Facebook,
  MultiStyleGenPlatform.TikTok,
  MultiStyleGenPlatform.LinkedIn,
  MultiStyleGenPlatform.Print,
  MultiStyleGenPlatform.Catalogue,
  MultiStyleGenPlatform.Billboard,
];

export const MULTI_STYLE_PLATFORM_CONFIG: Record<
  MultiStyleGenPlatform,
  { aspectRatio: string; resolution: string; width: number; height: number }
> = {
  [MultiStyleGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
  [MultiStyleGenPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
  [MultiStyleGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
  [MultiStyleGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
  [MultiStyleGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
  [MultiStyleGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
  [MultiStyleGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
  [MultiStyleGenPlatform.Catalogue]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
  [MultiStyleGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};

export const INDUSTRY_STYLE_MAP: Record<string, MultiStyleImageCategory> = {
  technology: MultiStyleImageCategory.Technology,
  software: MultiStyleImageCategory.Technology,
  fashion: MultiStyleImageCategory.Fashion,
  food: MultiStyleImageCategory.FoodPhotography,
  beauty: MultiStyleImageCategory.Luxury,
  default: MultiStyleImageCategory.Commercial,
};

export const VARIATION_STYLE_MAP: Record<MultiStyleVariationType, MultiStyleImageCategory> = {
  [MultiStyleVariationType.StyleVersionA]: MultiStyleImageCategory.Photorealistic,
  [MultiStyleVariationType.StyleVersionB]: MultiStyleImageCategory.Editorial,
  [MultiStyleVariationType.StyleVersionC]: MultiStyleImageCategory.Lifestyle,
  [MultiStyleVariationType.PremiumVersion]: MultiStyleImageCategory.Luxury,
  [MultiStyleVariationType.CommercialVersion]: MultiStyleImageCategory.Commercial,
  [MultiStyleVariationType.SocialMediaVersion]: MultiStyleImageCategory.Minimal,
  [MultiStyleVariationType.PrintVersion]: MultiStyleImageCategory.StudioPhotography,
};
