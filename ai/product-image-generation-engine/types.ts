/**
 * KWIZERA AI STUDIO — Product Image Generation Engine types (Step 9D)
 */

export enum ProductImageGenPlatform {
  Website = "website",
  Instagram = "instagram",
  Facebook = "facebook",
  TikTok = "tiktok",
  LinkedIn = "linkedin",
  Ecommerce = "ecommerce",
  Print = "print",
  Billboard = "billboard",
}

export enum ProductImageGenInputType {
  ProductInformation = "product-information",
  ProductImages = "product-images",
  BrandGuidelines = "brand-guidelines",
  Campaign = "campaign",
  StyleReferences = "style-references",
  KnowledgeRecord = "knowledge-record",
}

export enum ProductPresentationView {
  HeroImage = "hero-image",
  FrontView = "front-view",
  BackView = "back-view",
  LeftView = "left-view",
  RightView = "right-view",
  TopView = "top-view",
  BottomView = "bottom-view",
  ThreeSixtyPlanning = "360-planning",
  DetailCloseUp = "detail-close-up",
  LifestylePresentation = "lifestyle-presentation",
}

export enum ProductPhotographyMode {
  StudioPhotography = "studio-photography",
  LifestylePhotography = "lifestyle-photography",
  CommercialPhotography = "commercial-photography",
  LuxuryPhotography = "luxury-photography",
  WhiteBackground = "white-background",
  TransparentBackground = "transparent-background",
  CreativeBackground = "creative-background",
}

export enum ProductImageBackgroundType {
  WhiteBackground = "white-background",
  TransparentBackground = "transparent-background",
  StudioSetup = "studio-setup",
  HomeEnvironment = "home-environment",
  OfficeEnvironment = "office-environment",
  OutdoorEnvironment = "outdoor-environment",
  PremiumEnvironment = "premium-environment",
}

export enum ProductLightingType {
  StudioLighting = "studio-lighting",
  NaturalLighting = "natural-lighting",
  SoftboxLighting = "softbox-lighting",
  RimLighting = "rim-lighting",
  ProductHighlight = "product-highlight",
  ReflectionControl = "reflection-control",
  ShadowPlanning = "shadow-planning",
}

export enum ProductConsistencyRule {
  ProductShape = "product-shape",
  ProductColor = "product-color",
  ProductSize = "product-size",
  ProductTexture = "product-texture",
  LogoPlacement = "logo-placement",
  PackagingConsistency = "packaging-consistency",
}

export enum ProductMarketingVariation {
  SocialMedia = "social-media",
  Ecommerce = "ecommerce",
  Website = "website",
  Catalogue = "catalogue",
  Billboard = "billboard",
  Print = "print",
}

export interface ProductImagePlanProfile {
  productImagePlanId: string;
  productId: string;
  projectId: string;
  brandId: string;
  campaignId: string;
  platform: ProductImageGenPlatform;
  productCategory: string;
  version: number;
  language: string;
}

export interface ProductPresentationPlan {
  views: ProductPresentationViewDefinition[];
  showcaseLayout: string;
  heroPlacement: string;
  catalogueStructure: string[];
}

export interface ProductPresentationViewDefinition {
  view: ProductPresentationView;
  description: string;
  cameraAngle: string;
  framing: string;
  priority: number;
}

export interface ProductPhotographyPlan {
  primaryMode: ProductPhotographyMode;
  modes: ProductPhotographyMode[];
  studioSetup: string;
  commercialStyle: string;
  luxuryTreatment: string;
  notes: string[];
}

export interface ProductBackgroundPlan {
  primaryBackground: ProductImageBackgroundType;
  backgroundDescription: string;
  environmentNotes: string;
  replacementStrategy: string;
  colorHarmony: string;
}

export interface ProductLightingPlan {
  studioLighting: string;
  naturalLighting: string;
  softboxLighting: string;
  rimLighting: string;
  productHighlight: string;
  reflectionControl: string;
  shadowPlanning: string;
}

export interface ProductConsistencyPlan {
  rules: ProductConsistencyRule[];
  shapeLock: boolean;
  colorLock: boolean;
  sizeReference: string;
  textureNotes: string;
  logoPlacement: string;
  packagingNotes: string;
}

export interface ProductMarketingVariationPlan {
  variation: ProductMarketingVariation;
  platform: ProductImageGenPlatform;
  aspectRatio: string;
  resolution: string;
  adaptationNotes: string[];
}

export interface ProductImagePlatformOptimization {
  platform: ProductImageGenPlatform;
  aspectRatio: string;
  resolution: string;
  marketplaceNotes: string[];
  optimizationNotes: string[];
}

export interface ProductionProductImageInstructions {
  renderNotes: string[];
  photographyGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
}

export interface ProductImageGenerationScores {
  productPresentationScore: number;
  photographyScore: number;
  brandConsistencyScore: number;
  marketplaceReadinessScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface ProductImageGenerationRelationships {
  products: string[];
  brands: string[];
  campaigns: string[];
  sourceImages: string[];
  generatedImages: string[];
  templates: string[];
  knowledgeRecords: string[];
  textToImagePlans: string[];
  imageToImagePlans: string[];
}

export interface ProductImageGenerationInput {
  productId: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: ProductImageGenPlatform;
  language?: string;
  productCategory?: string;
  sourceImageIds?: string[];
  styleReferenceIds?: string[];
  knowledgeRecordIds?: string[];
  photographyMode?: ProductPhotographyMode;
  backgroundType?: ProductImageBackgroundType;
  textToImagePlanId?: string;
  generateMarketingVariations?: boolean;
  generatePlatformOptimizations?: boolean;
  inputTypes?: ProductImageGenInputType[];
}

export interface ProductImageGenerationRecord {
  productImagePlanId: string;
  profile: ProductImagePlanProfile;
  presentationPlan: ProductPresentationPlan;
  photographyPlan: ProductPhotographyPlan;
  backgroundPlan: ProductBackgroundPlan;
  lightingPlan: ProductLightingPlan;
  consistencyPlan: ProductConsistencyPlan;
  marketingVariations: ProductMarketingVariationPlan[];
  platformOptimizations: ProductImagePlatformOptimization[];
  productionInstructions: ProductionProductImageInstructions;
  blueprintId?: string;
  scores: ProductImageGenerationScores;
  relationships: ProductImageGenerationRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  marketplaceReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface ProductImageGenerationResult {
  success: boolean;
  record?: ProductImageGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ProductImageGenerationSearchQuery {
  productImagePlanId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  platform?: ProductImageGenPlatform;
  productCategory?: string;
  photographyMode?: ProductPhotographyMode;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface ProductImageGenerationEngineStatusReport {
  engineStatus: string;
  productPlanningStatus: string;
  photographyPlanningStatus: string;
  backgroundPlanningStatus: string;
  consistencyStatus: string;
  marketplaceOptimizationStatus: string;
  productImagePlansGenerated: number;
  averageProductPresentationScore: number;
  averageMarketplaceReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averagePlanningMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ProductImageGenerationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProductImageGenerationEngineError";
  }
}

export const ALL_PRODUCT_PRESENTATION_VIEWS: ProductPresentationView[] = [
  ProductPresentationView.HeroImage,
  ProductPresentationView.FrontView,
  ProductPresentationView.BackView,
  ProductPresentationView.LeftView,
  ProductPresentationView.RightView,
  ProductPresentationView.TopView,
  ProductPresentationView.BottomView,
  ProductPresentationView.ThreeSixtyPlanning,
  ProductPresentationView.DetailCloseUp,
  ProductPresentationView.LifestylePresentation,
];

export const ALL_PRODUCT_PHOTOGRAPHY_MODES: ProductPhotographyMode[] = [
  ProductPhotographyMode.StudioPhotography,
  ProductPhotographyMode.LifestylePhotography,
  ProductPhotographyMode.CommercialPhotography,
  ProductPhotographyMode.LuxuryPhotography,
  ProductPhotographyMode.WhiteBackground,
  ProductPhotographyMode.TransparentBackground,
  ProductPhotographyMode.CreativeBackground,
];

export const ALL_PRODUCT_CONSISTENCY_RULES: ProductConsistencyRule[] = [
  ProductConsistencyRule.ProductShape,
  ProductConsistencyRule.ProductColor,
  ProductConsistencyRule.ProductSize,
  ProductConsistencyRule.ProductTexture,
  ProductConsistencyRule.LogoPlacement,
  ProductConsistencyRule.PackagingConsistency,
];

export const ALL_PRODUCT_MARKETING_VARIATIONS: ProductMarketingVariation[] = [
  ProductMarketingVariation.SocialMedia,
  ProductMarketingVariation.Ecommerce,
  ProductMarketingVariation.Website,
  ProductMarketingVariation.Catalogue,
  ProductMarketingVariation.Billboard,
  ProductMarketingVariation.Print,
];

export const ALL_PRODUCT_IMAGE_GEN_PLATFORMS: ProductImageGenPlatform[] = [
  ProductImageGenPlatform.Website,
  ProductImageGenPlatform.Instagram,
  ProductImageGenPlatform.Facebook,
  ProductImageGenPlatform.TikTok,
  ProductImageGenPlatform.LinkedIn,
  ProductImageGenPlatform.Ecommerce,
  ProductImageGenPlatform.Print,
  ProductImageGenPlatform.Billboard,
];

export const PLATFORM_CONFIG: Record<
  ProductImageGenPlatform,
  { aspectRatio: string; resolution: string; width: number; height: number }
> = {
  [ProductImageGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
  [ProductImageGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
  [ProductImageGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
  [ProductImageGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
  [ProductImageGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
  [ProductImageGenPlatform.Ecommerce]: { aspectRatio: "1:1", resolution: "2000x2000", width: 2000, height: 2000 },
  [ProductImageGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
  [ProductImageGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
