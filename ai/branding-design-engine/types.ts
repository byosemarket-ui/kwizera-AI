/**
 * KWIZERA AI STUDIO — Branding & Graphic Design Engine types (Step 9H)
 */

export enum BrandDesignGenPlatform {
  Website = "website",
  Mobile = "mobile",
  Instagram = "instagram",
  Facebook = "facebook",
  LinkedIn = "linkedin",
  TikTok = "tiktok",
  YouTube = "youtube",
  Print = "print",
  Catalogue = "catalogue",
  Billboard = "billboard",
}

export enum BrandDesignGenInputType {
  BrandGuidelines = "brand-guidelines",
  Product = "product",
  Campaign = "campaign",
  MarketingObjective = "marketing-objective",
  Prompt = "prompt",
  Image = "image",
  Logo = "logo",
  Font = "font",
  Icon = "icon",
  ColorPalette = "color-palette",
  Template = "template",
  KnowledgeRecord = "knowledge-record",
}

export enum BrandDesignType {
  BrandingPlan = "branding-plan",
  LogoDesign = "logo-design",
  PosterLayout = "poster-layout",
  FlyerLayout = "flyer-layout",
  BannerLayout = "banner-layout",
  BusinessCardLayout = "business-card-layout",
  BrochureLayout = "brochure-layout",
  PackagingLayout = "packaging-layout",
  SocialMediaGraphic = "social-media-graphic",
  ThumbnailLayout = "thumbnail-layout",
  PresentationGraphic = "presentation-graphic",
}

export enum BrandDesignMaterialType {
  Poster = "poster",
  Flyer = "flyer",
  Brochure = "brochure",
  RollUpBanner = "roll-up-banner",
  Billboard = "billboard",
  SocialMediaPost = "social-media-post",
  Story = "story",
  Cover = "cover",
  BusinessCard = "business-card",
  Letterhead = "letterhead",
  Envelope = "envelope",
  Packaging = "packaging",
}

export enum BrandDesignSocialFormat {
  InstagramPost = "instagram-post",
  InstagramStory = "instagram-story",
  FacebookPost = "facebook-post",
  FacebookCover = "facebook-cover",
  LinkedInPost = "linkedin-post",
  LinkedInBanner = "linkedin-banner",
  TikTokCover = "tiktok-cover",
  YouTubeThumbnail = "youtube-thumbnail",
  YouTubeBanner = "youtube-banner",
}

export enum BrandDesignPrintFormat {
  A4 = "a4",
  A5 = "a5",
  A3 = "a3",
  BusinessCard = "business-card",
  RollUpBanner = "roll-up-banner",
  Billboard = "billboard",
  Packaging = "packaging",
  Sticker = "sticker",
  Label = "label",
}

export enum BrandDesignLogoVariant {
  PrimaryLogo = "primary-logo",
  SecondaryLogo = "secondary-logo",
  IconVersion = "icon-version",
  MonochromeVersion = "monochrome-version",
  LightBackgroundVersion = "light-background-version",
  DarkBackgroundVersion = "dark-background-version",
}

export enum BrandDesignConsistencyElement {
  LogoUsage = "logo-usage",
  Typography = "typography",
  ColorPalette = "color-palette",
  BrandStyle = "brand-style",
  BrandVoice = "brand-voice",
  VisualIdentity = "visual-identity",
}

export interface BrandDesignProfile {
  brandDesignId: string;
  projectId: string;
  brandId: string;
  campaignId: string;
  productId: string;
  platform: BrandDesignGenPlatform;
  designType: BrandDesignType;
  promptId: string;
  version: number;
  language: string;
}

export interface DesignPlanningPlan {
  layoutStructure: string;
  visualHierarchy: string;
  gridSystem: string;
  composition: string;
  alignment: string;
  whiteSpacePlanning: string;
  typographyPlanning: string[];
  iconPlanning: string[];
  illustrationPlanning: string[];
}

export interface LogoPlanningPlan {
  variants: BrandDesignLogoVariant[];
  primaryLogoNotes: string;
  secondaryLogoNotes: string;
  iconVersionNotes: string;
  monochromeNotes: string;
  lightBackgroundNotes: string;
  darkBackgroundNotes: string;
  usageGuidelines: string[];
}

export interface MarketingMaterialsPlan {
  materials: BrandDesignMaterialType[];
  materialNotes: Record<string, string>;
  campaignAdaptations: string[];
}

export interface SocialMediaDesignPlan {
  formats: BrandDesignSocialFormat[];
  formatSpecs: Record<string, { aspectRatio: string; resolution: string }>;
  platformNotes: string[];
}

export interface PrintDesignPlan {
  formats: BrandDesignPrintFormat[];
  formatSpecs: Record<string, { dimensions: string; bleed: string }>;
  printNotes: string[];
}

export interface BrandConsistencyPlan {
  elements: BrandDesignConsistencyElement[];
  logoUsageRules: string[];
  typographyRules: string[];
  colorPaletteRules: string[];
  brandStyleRules: string[];
  brandVoiceNotes: string[];
  visualIdentityNotes: string[];
}

export interface ColorManagementPlan {
  rgbPalette: string[];
  cmykPalette: string[];
  pantoneReferences: string[];
  iccProfilePlanning: string;
  contrastValidation: string;
}

export interface BrandingDesignScores {
  brandingScore: number;
  graphicDesignScore: number;
  layoutScore: number;
  typographyScore: number;
  brandConsistencyScore: number;
  printReadinessScore: number;
  aiConfidenceScore: number;
}

export interface BrandingDesignRelationships {
  brands: string[];
  products: string[];
  campaigns: string[];
  templates: string[];
  images: string[];
  logos: string[];
  knowledgeRecords: string[];
  productImagePlans: string[];
  enhancementPlans: string[];
}

export interface BrandingDesignInput {
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  marketingObjective?: string;
  designPrompt?: string;
  platform?: BrandDesignGenPlatform;
  designType?: BrandDesignType;
  language?: string;
  logoIds?: string[];
  fontIds?: string[];
  iconIds?: string[];
  colorPalette?: string[];
  templateIds?: string[];
  imageIds?: string[];
  knowledgeRecordIds?: string[];
  productImagePlanId?: string;
  enhancementPlanId?: string;
  generateLogoPlan?: boolean;
  generateMarketingMaterials?: boolean;
  generateSocialMediaDesign?: boolean;
  generatePrintDesign?: boolean;
  generatePlatformOptimizations?: boolean;
  inputTypes?: BrandDesignGenInputType[];
}

export interface BrandingDesignRecord {
  brandDesignId: string;
  profile: BrandDesignProfile;
  designPlanning: DesignPlanningPlan;
  logoPlanning: LogoPlanningPlan;
  marketingMaterials: MarketingMaterialsPlan;
  socialMediaDesign: SocialMediaDesignPlan;
  printDesign: PrintDesignPlan;
  brandConsistency: BrandConsistencyPlan;
  colorManagement: ColorManagementPlan;
  platformOptimizations: Array<{
    platform: BrandDesignGenPlatform;
    aspectRatio: string;
    resolution: string;
    notes: string[];
  }>;
  productionInstructions: {
    renderNotes: string[];
    layoutGuidance: string[];
    exportPreparation: string[];
    qualityTargets: string[];
  };
  blueprintId?: string;
  scores: BrandingDesignScores;
  relationships: BrandingDesignRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  printReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface BrandingDesignResult {
  success: boolean;
  record?: BrandingDesignRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface BrandingDesignSearchQuery {
  brandDesignId?: string;
  brandId?: string;
  productId?: string;
  campaignId?: string;
  platform?: BrandDesignGenPlatform;
  designType?: BrandDesignType;
  templateId?: string;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface BrandingDesignEngineStatusReport {
  engineStatus: string;
  designPlanningStatus: string;
  logoPlanningStatus: string;
  marketingMaterialsStatus: string;
  socialMediaDesignStatus: string;
  printDesignStatus: string;
  brandingPlansGenerated: number;
  averageBrandingScore: number;
  averagePrintReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averagePlanningMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class BrandingDesignEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "BrandingDesignEngineError";
  }
}

export const ALL_BRAND_DESIGN_TYPES: BrandDesignType[] = [
  BrandDesignType.BrandingPlan,
  BrandDesignType.LogoDesign,
  BrandDesignType.PosterLayout,
  BrandDesignType.FlyerLayout,
  BrandDesignType.BannerLayout,
  BrandDesignType.BusinessCardLayout,
  BrandDesignType.BrochureLayout,
  BrandDesignType.PackagingLayout,
  BrandDesignType.SocialMediaGraphic,
  BrandDesignType.ThumbnailLayout,
  BrandDesignType.PresentationGraphic,
];

export const ALL_BRAND_DESIGN_MATERIALS: BrandDesignMaterialType[] = [
  BrandDesignMaterialType.Poster,
  BrandDesignMaterialType.Flyer,
  BrandDesignMaterialType.Brochure,
  BrandDesignMaterialType.RollUpBanner,
  BrandDesignMaterialType.Billboard,
  BrandDesignMaterialType.SocialMediaPost,
  BrandDesignMaterialType.Story,
  BrandDesignMaterialType.Cover,
  BrandDesignMaterialType.BusinessCard,
  BrandDesignMaterialType.Letterhead,
  BrandDesignMaterialType.Envelope,
  BrandDesignMaterialType.Packaging,
];

export const ALL_BRAND_DESIGN_SOCIAL_FORMATS: BrandDesignSocialFormat[] = [
  BrandDesignSocialFormat.InstagramPost,
  BrandDesignSocialFormat.InstagramStory,
  BrandDesignSocialFormat.FacebookPost,
  BrandDesignSocialFormat.FacebookCover,
  BrandDesignSocialFormat.LinkedInPost,
  BrandDesignSocialFormat.LinkedInBanner,
  BrandDesignSocialFormat.TikTokCover,
  BrandDesignSocialFormat.YouTubeThumbnail,
  BrandDesignSocialFormat.YouTubeBanner,
];

export const ALL_BRAND_DESIGN_PRINT_FORMATS: BrandDesignPrintFormat[] = [
  BrandDesignPrintFormat.A4,
  BrandDesignPrintFormat.A5,
  BrandDesignPrintFormat.A3,
  BrandDesignPrintFormat.BusinessCard,
  BrandDesignPrintFormat.RollUpBanner,
  BrandDesignPrintFormat.Billboard,
  BrandDesignPrintFormat.Packaging,
  BrandDesignPrintFormat.Sticker,
  BrandDesignPrintFormat.Label,
];

export const ALL_BRAND_DESIGN_LOGO_VARIANTS: BrandDesignLogoVariant[] = [
  BrandDesignLogoVariant.PrimaryLogo,
  BrandDesignLogoVariant.SecondaryLogo,
  BrandDesignLogoVariant.IconVersion,
  BrandDesignLogoVariant.MonochromeVersion,
  BrandDesignLogoVariant.LightBackgroundVersion,
  BrandDesignLogoVariant.DarkBackgroundVersion,
];

export const ALL_BRAND_DESIGN_CONSISTENCY_ELEMENTS: BrandDesignConsistencyElement[] = [
  BrandDesignConsistencyElement.LogoUsage,
  BrandDesignConsistencyElement.Typography,
  BrandDesignConsistencyElement.ColorPalette,
  BrandDesignConsistencyElement.BrandStyle,
  BrandDesignConsistencyElement.BrandVoice,
  BrandDesignConsistencyElement.VisualIdentity,
];

export const ALL_BRAND_DESIGN_GEN_PLATFORMS: BrandDesignGenPlatform[] = [
  BrandDesignGenPlatform.Website,
  BrandDesignGenPlatform.Mobile,
  BrandDesignGenPlatform.Instagram,
  BrandDesignGenPlatform.Facebook,
  BrandDesignGenPlatform.LinkedIn,
  BrandDesignGenPlatform.TikTok,
  BrandDesignGenPlatform.YouTube,
  BrandDesignGenPlatform.Print,
  BrandDesignGenPlatform.Catalogue,
  BrandDesignGenPlatform.Billboard,
];

export const BRAND_DESIGN_PLATFORM_CONFIG: Record<
  BrandDesignGenPlatform,
  { aspectRatio: string; resolution: string; width: number; height: number }
> = {
  [BrandDesignGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
  [BrandDesignGenPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
  [BrandDesignGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
  [BrandDesignGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
  [BrandDesignGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
  [BrandDesignGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
  [BrandDesignGenPlatform.YouTube]: { aspectRatio: "16:9", resolution: "2560x1440", width: 2560, height: 1440 },
  [BrandDesignGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
  [BrandDesignGenPlatform.Catalogue]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
  [BrandDesignGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};

export const SOCIAL_FORMAT_CONFIG: Record<
  BrandDesignSocialFormat,
  { aspectRatio: string; resolution: string }
> = {
  [BrandDesignSocialFormat.InstagramPost]: { aspectRatio: "1:1", resolution: "1080x1080" },
  [BrandDesignSocialFormat.InstagramStory]: { aspectRatio: "9:16", resolution: "1080x1920" },
  [BrandDesignSocialFormat.FacebookPost]: { aspectRatio: "1.91:1", resolution: "1200x628" },
  [BrandDesignSocialFormat.FacebookCover]: { aspectRatio: "2.63:1", resolution: "820x312" },
  [BrandDesignSocialFormat.LinkedInPost]: { aspectRatio: "1.91:1", resolution: "1200x627" },
  [BrandDesignSocialFormat.LinkedInBanner]: { aspectRatio: "4:1", resolution: "1584x396" },
  [BrandDesignSocialFormat.TikTokCover]: { aspectRatio: "9:16", resolution: "1080x1920" },
  [BrandDesignSocialFormat.YouTubeThumbnail]: { aspectRatio: "16:9", resolution: "1280x720" },
  [BrandDesignSocialFormat.YouTubeBanner]: { aspectRatio: "16:9", resolution: "2560x1440" },
};

export const PRINT_FORMAT_CONFIG: Record<
  BrandDesignPrintFormat,
  { dimensions: string; bleed: string }
> = {
  [BrandDesignPrintFormat.A4]: { dimensions: "210x297mm", bleed: "3mm" },
  [BrandDesignPrintFormat.A5]: { dimensions: "148x210mm", bleed: "3mm" },
  [BrandDesignPrintFormat.A3]: { dimensions: "297x420mm", bleed: "3mm" },
  [BrandDesignPrintFormat.BusinessCard]: { dimensions: "85x55mm", bleed: "3mm" },
  [BrandDesignPrintFormat.RollUpBanner]: { dimensions: "850x2000mm", bleed: "0mm" },
  [BrandDesignPrintFormat.Billboard]: { dimensions: "6000x2000mm", bleed: "0mm" },
  [BrandDesignPrintFormat.Packaging]: { dimensions: "custom die-line", bleed: "5mm" },
  [BrandDesignPrintFormat.Sticker]: { dimensions: "custom", bleed: "2mm" },
  [BrandDesignPrintFormat.Label]: { dimensions: "custom", bleed: "2mm" },
};
