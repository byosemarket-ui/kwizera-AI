/**
 * KWIZERA AI STUDIO — Product Understanding Engine types (Step 5C)
 */

export enum ProductUnderstandingMarketingGoal {
  Conversion = "conversion",
  Awareness = "awareness",
  Engagement = "engagement",
  Retention = "retention",
  Launch = "launch",
  Education = "education",
}

export interface ProductIdentity {
  productName: string;
  brand: string;
  category: string;
  subcategory: string;
  productId: string;
  valueProposition: string;
}

export interface ProductPurpose {
  primaryPurpose: string;
  mainFunction: string;
  secondaryFunctions: string[];
  whyItExists: string;
}

export interface CustomerUnderstanding {
  targetCustomer: string;
  targetIndustry: string;
  customerNeeds: string[];
  customerPainPoints: string[];
  customerBenefits: string[];
  customerExpectations: string[];
  customerSegments: string[];
}

export interface ValueAnalysis {
  functionalValue: number;
  emotionalValue: number;
  practicalValue: number;
  commercialValue: number;
  brandValue: number;
  marketValue: number;
}

export interface UniqueValue {
  uniqueSellingPoints: string[];
  competitiveAdvantages: string[];
  premiumFeatures: string[];
  keyBenefits: string[];
  customerMotivations: string[];
  reasonsToBuy: string[];
}

export interface ProductContext {
  whereUsed: string;
  howUsed: string;
  whenUsed: string;
  whoUsesIt: string;
  whyCustomersChoose: string;
  typicalPurchasingSituations: string[];
}

export interface UnderstandingMarketingPreparation {
  audienceIntelligenceReady: boolean;
  marketingStrategyReady: boolean;
  creativeDirectionReady: boolean;
  storyboardReady: boolean;
  scriptPlanningReady: boolean;
  visualPlanningReady: boolean;
  productionPlanningReady: boolean;
  preparedModules: string[];
  gaps: string[];
}

export interface UnderstandingScores {
  understandingScore: number;
  businessValueScore: number;
  customerValueScore: number;
  marketingReadinessScore: number;
  aiConfidenceScore: number;
}

export interface ProductUnderstandingRelationships {
  similarProducts: string[];
  customerSegments: string[];
  businessCategories: string[];
  marketingStrategies: string[];
  creativeStyles: string[];
  projects: string[];
  knowledgeRecords: string[];
}

export interface ProductUnderstandingInput {
  productId: string;
  marketingGoal?: ProductUnderstandingMarketingGoal;
  relatedProjects?: string[];
  relatedKnowledge?: string[];
  customerSegments?: string[];
}

export interface ProductUnderstandingRecord {
  productId: string;
  understandingId: string;
  analysisId: string;
  identity: ProductIdentity;
  purpose: ProductPurpose;
  customer: CustomerUnderstanding;
  valueAnalysis: ValueAnalysis;
  uniqueValue: UniqueValue;
  context: ProductContext;
  marketingPreparation: UnderstandingMarketingPreparation;
  scores: UnderstandingScores;
  relationships: ProductUnderstandingRelationships;
  marketingGoal: ProductUnderstandingMarketingGoal;
  validated: boolean;
  understoodAt: string;
  lastUpdated: string;
  version: number;
}

export interface ProductUnderstandingResult {
  success: boolean;
  record?: ProductUnderstandingRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ProductUnderstandingSearchQuery {
  purpose?: string;
  benefits?: string;
  customerNeeds?: string;
  industry?: string;
  useCase?: string;
  targetAudience?: string;
  valueProposition?: string;
  marketingGoal?: ProductUnderstandingMarketingGoal;
  text?: string;
  limit?: number;
}

export interface ProductUnderstandingEngineStatusReport {
  engineStatus: string;
  valueAnalysisStatus: string;
  customerUnderstandingStatus: string;
  relationshipStatus: string;
  productsUnderstood: number;
  averageUnderstandingScore: number;
  averageBusinessValueScore: number;
  performance: {
    averageUnderstandingMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ProductUnderstandingEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProductUnderstandingEngineError";
  }
}
