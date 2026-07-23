/**
 * KWIZERA AI STUDIO — Product Analysis Engine types (Step 5B)
 */

export enum ProductAnalysisIndustry {
  Technology = "technology",
  Fashion = "fashion",
  Beauty = "beauty",
  Food = "food",
  Hospitality = "hospitality",
  Automotive = "automotive",
  RealEstate = "real-estate",
  Education = "education",
  Health = "health",
  HomeLiving = "home-living",
  Creative = "creative",
  General = "general",
}

export enum ProductAnalysisCategory {
  Electronics = "electronics",
  Fashion = "fashion",
  Shoes = "shoes",
  Bags = "bags",
  Beauty = "beauty",
  Food = "food",
  Restaurant = "restaurant",
  Hotel = "hotel",
  Furniture = "furniture",
  HomeAppliances = "home-appliances",
  Vehicles = "vehicles",
  RealEstate = "real-estate",
  Education = "education",
  Health = "health",
  Software = "software",
  Services = "services",
}

export enum ProductBusinessType {
  B2C = "b2c",
  B2B = "b2b",
  D2C = "d2c",
  Marketplace = "marketplace",
  Subscription = "subscription",
  Enterprise = "enterprise",
}

export enum ProductAvailabilityStatus {
  InStock = "in-stock",
  PreOrder = "pre-order",
  OutOfStock = "out-of-stock",
  Discontinued = "discontinued",
  ComingSoon = "coming-soon",
}

export interface ProductAnalysisProfile {
  productName: string;
  category: ProductAnalysisCategory;
  subcategory: string;
  brand: string;
  model?: string;
  sku?: string;
  description: string;
  features: string[];
  specifications: Record<string, string>;
  materials: string[];
  dimensions?: string;
  weight?: string;
  colors: string[];
  sizes: string[];
  packaging?: string;
  countryOfOrigin?: string;
  supplier?: string;
  price: number;
  currency: string;
  availability: ProductAvailabilityStatus;
}

export interface ProductVisualPreparation {
  productImages: string[];
  productAngles: string[];
  productBackground: string;
  productVisibility: number;
  productPackaging: string;
  productQuality: number;
  productLighting: string;
  productComposition: string;
}

export interface ProductClassification {
  industry: ProductAnalysisIndustry;
  category: ProductAnalysisCategory;
  subcategory: string;
  useCase: string;
  targetCustomer: string;
  businessType: ProductBusinessType;
}

export interface ProductMarketingPreparation {
  marketingStrategyReady: boolean;
  creativeDirectionReady: boolean;
  storyboardReady: boolean;
  scriptPlanningReady: boolean;
  visualPlanningReady: boolean;
  audioPlanningReady: boolean;
  videoGenerationReady: boolean;
  preparedFields: string[];
  gaps: string[];
}

export interface ProductCompletenessScores {
  completenessScore: number;
  dataQualityScore: number;
  marketingReadinessScore: number;
  analysisConfidenceScore: number;
}

export interface ProductAnalysisRelationships {
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCategories: string[];
  relatedProjects: string[];
  relatedMarketingCampaigns: string[];
  relatedKnowledge: string[];
  relatedMemory: string[];
}

export interface ProductAnalysisEngineInput {
  productId?: string;
  productName?: string;
  category?: ProductAnalysisCategory;
  subcategory?: string;
  brand?: string;
  model?: string;
  sku?: string;
  description?: string;
  features?: string[];
  specifications?: Record<string, string>;
  materials?: string[];
  dimensions?: string;
  weight?: string;
  colors?: string[];
  sizes?: string[];
  packaging?: string;
  countryOfOrigin?: string;
  supplier?: string;
  price?: number;
  currency?: string;
  availability?: ProductAvailabilityStatus;
  visual?: Partial<ProductVisualPreparation>;
  industry?: ProductAnalysisIndustry;
  useCase?: string;
  targetCustomer?: string;
  businessType?: ProductBusinessType;
  tags?: string[];
  keywords?: string[];
  relatedKnowledge?: string[];
  relatedMemory?: string[];
  relatedProjects?: string[];
}

export interface ProductAnalysisIntelligenceRecord {
  productId: string;
  analysisId: string;
  knowledgeId?: string;
  profile: ProductAnalysisProfile;
  visual: ProductVisualPreparation;
  classification: ProductClassification;
  marketingPreparation: ProductMarketingPreparation;
  scores: ProductCompletenessScores;
  relationships: ProductAnalysisRelationships;
  missingFields: string[];
  tags: string[];
  keywords: string[];
  validated: boolean;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface ProductAnalysisEngineResult {
  success: boolean;
  record?: ProductAnalysisIntelligenceRecord;
  durationMs: number;
  diagnostics: string[];
  missingFields: string[];
  message?: string;
}

export interface ProductAnalysisSearchQuery {
  productName?: string;
  brand?: string;
  category?: ProductAnalysisCategory;
  subcategory?: string;
  sku?: string;
  industry?: ProductAnalysisIndustry;
  supplier?: string;
  tags?: string[];
  keywords?: string[];
  text?: string;
  limit?: number;
}

export interface ProductAnalysisEngineStatusReport {
  engineStatus: string;
  classificationStatus: string;
  relationshipStatus: string;
  completenessStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productsAnalyzed: number;
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

export class ProductAnalysisEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProductAnalysisEngineError";
  }
}
