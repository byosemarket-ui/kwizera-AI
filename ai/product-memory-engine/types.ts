/**
 * KWIZERA AI STUDIO — Product Memory Engine types (Step 3I)
 */

export enum ProductStatus {
  Draft = "draft",
  Active = "active",
  Archived = "archived",
  Discontinued = "discontinued",
}

export interface ProductVisualMemory {
  productImages: string[];
  productBackgrounds: string[];
  productAngles: string[];
  lightingStyle: string;
  presentationStyle: string;
  colorPalette: string[];
  packagingStyle: string;
  productLayout: string;
}

export interface ProductVideoRelationships {
  promotionalVideos: string[];
  marketingCampaigns: string[];
  posters: string[];
  banners: string[];
  socialMediaContent: string[];
  exportedAssets: string[];
}

export interface ProductMarketingMemory {
  bestHeadlines: string[];
  bestHooks: string[];
  bestCta: string[];
  bestDescriptions: string[];
  bestSellingPoints: string[];
  emotionalMarketingStyle: string;
  storytellingStyle: string;
}

export interface ProductCustomerPreferences {
  preferredProducts: string[];
  preferredCategories: string[];
  preferredColors: string[];
  preferredPriceRange: string;
  preferredPresentationStyle: string;
  preferredMarketingStyle: string;
}

export interface ProductQualityScores {
  profileScore: number;
  visualScore: number;
  marketingScore: number;
  learningScore: number;
  aiConfidenceScore: number;
}

export interface ProductPattern {
  patternId: string;
  patternType:
    | "product-layout"
    | "product-image"
    | "product-video"
    | "marketing-structure"
    | "sales-message"
    | "branding-style";
  description: string;
  sourceProductId: string;
  confidence: number;
  reusable: boolean;
  detectedAt: string;
}

export interface ProductVersionInfo {
  version: number;
  timestamp: string;
  changeSummary: string;
  memoryVersion: number;
}

export interface ProductCreateInput {
  productId?: string;
  projectId?: string;
  productName: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  sku?: string;
  description?: string;
  features?: string[];
  specifications?: Record<string, string>;
  materials?: string[];
  colors?: string[];
  sizes?: string[];
  price?: number;
  currency?: string;
  availability?: string;
  countryOfOrigin?: string;
  supplier?: string;
  language?: string;
  marketingGoal?: string;
  visual?: Partial<ProductVisualMemory>;
  marketing?: Partial<ProductMarketingMemory>;
  videoRelationships?: Partial<ProductVideoRelationships>;
  customerPreferences?: Partial<ProductCustomerPreferences>;
  tags?: string[];
  keywords?: string[];
}

export interface ProductUpdateInput {
  productName?: string;
  status?: ProductStatus;
  brand?: string;
  category?: string;
  subcategory?: string;
  sku?: string;
  description?: string;
  features?: string[];
  featuresAppend?: string[];
  specifications?: Record<string, string>;
  materials?: string[];
  colors?: string[];
  sizes?: string[];
  price?: number;
  currency?: string;
  availability?: string;
  countryOfOrigin?: string;
  supplier?: string;
  language?: string;
  marketingGoal?: string;
  visual?: Partial<ProductVisualMemory>;
  marketing?: Partial<ProductMarketingMemory>;
  marketingAppend?: Partial<ProductMarketingMemory>;
  videoRelationships?: Partial<ProductVideoRelationships>;
  customerPreferences?: Partial<ProductCustomerPreferences>;
  lessonsLearned?: string[];
  strengths?: string[];
  weaknesses?: string[];
  presentationStyleRating?: number;
  tags?: string[];
  keywords?: string[];
}

export interface ProductRecord {
  productId: string;
  memoryId: string;
  projectId?: string;
  productName: string;
  brand: string;
  category: string;
  subcategory: string;
  sku: string;
  description: string;
  features: string[];
  specifications: Record<string, string>;
  materials: string[];
  colors: string[];
  sizes: string[];
  price: number;
  currency: string;
  availability: string;
  countryOfOrigin: string;
  supplier: string;
  language: string;
  marketingGoal: string;
  status: ProductStatus;
  creationDate: string;
  lastUpdated: string;
  visual: ProductVisualMemory;
  marketing: ProductMarketingMemory;
  videoRelationships: ProductVideoRelationships;
  customerPreferences: ProductCustomerPreferences;
  scores: ProductQualityScores;
  patterns: ProductPattern[];
  relatedMemories: string[];
  lessonsLearned: string[];
  strengths: string[];
  weaknesses: string[];
  versions: ProductVersionInfo[];
  tags: string[];
  keywords: string[];
}

export interface ProductProcessResult {
  success: boolean;
  productId: string;
  memoryId: string;
  version: number;
  durationMs: number;
  patternsDetected: number;
  reason?: string;
}

export interface ProductLearningResult {
  success: boolean;
  productId: string;
  patternsStored: number;
  learningId?: string;
  recommendations: string[];
  lessons: string[];
}

export interface ProductRelationships {
  similarProducts: string[];
  relatedProducts: string[];
  complementaryProducts: string[];
  replacementProducts: string[];
  sameBrand: string[];
  sameCampaign: string[];
  relatedVideos: string[];
  relatedMarketing: string[];
  relatedMemories: string[];
}

export interface ProductMemoryStatusReport {
  engineStatus: string;
  relationshipStatus: string;
  patternDetectionStatus: string;
  learningStatus: string;
  totalProducts: number;
  totalPatterns: number;
  totalPreferenceFields: number;
  performance: {
    averageSaveMs: number;
    averageLoadMs: number;
    averageSearchMs: number;
    totalVersions: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ProductMemoryEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProductMemoryEngineError";
  }
}
