/** Phase 3 Step 4 — Master Product Intelligence Report & Creative Brief Engine */

import type { ProductIntelligencePackage } from "../deep-intelligence/types";
import type { ResearchPackage } from "../market-research/types";
import type { ProductProfile } from "../product-profile/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import type { ProductionInputPackage } from "../product-validation/types";
import type { VisualProductAnalysisPackage } from "../visual-analysis/types";

export type FactClassification =
  | "VERIFIED FACT"
  | "USER PROVIDED"
  | "RESEARCH SUPPORTED"
  | "VISUAL OBSERVATION"
  | "AI INFERENCE"
  | "AI RECOMMENDATION"
  | "UNKNOWN";

export type DifferentiatorClass =
  | "VERIFIED DIFFERENTIATOR"
  | "POSSIBLE DIFFERENTIATOR"
  | "MARKETING RECOMMENDATION";

export type ClaimSafetyStatus =
  | "SAFE / VERIFIED"
  | "SUPPORTED BUT REVIEW"
  | "UNVERIFIED"
  | "DO NOT USE";

export type MissingSeverity = "CRITICAL" | "RECOMMENDED" | "OPTIONAL";

export type FreshnessBand = "CURRENT" | "RECENT" | "AGING" | "STALE" | "UNKNOWN";

export type MasterStage =
  | "loaded"
  | "identity"
  | "verified-facts"
  | "visual"
  | "features"
  | "differentiators"
  | "benefits"
  | "customer"
  | "market"
  | "competitive"
  | "knowledge"
  | "marketing"
  | "creative"
  | "opportunities"
  | "claim-safety"
  | "restrictions"
  | "missing"
  | "sources"
  | "confidence"
  | "score"
  | "saved";

export type MasterPackageStatus =
  | "idle"
  | "running"
  | "draft"
  | "review"
  | "confirmed"
  | "partial";

export interface ClassifiedItem {
  id: string;
  label: string;
  value: string;
  classification: FactClassification;
  source: string;
  evidence: string;
  confidence: number;
  freshness?: FreshnessBand;
  date?: string | null;
}

export interface ProductIdentitySummary {
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  model: string;
  variants: string[];
  identityConfidence: number;
}

export interface VerifiedFactsBlock {
  productName: string;
  brand: string;
  category: string;
  price: number | null;
  currency: string;
  description: string;
  materials: string[];
  colors: string[];
  sizes: string[];
  specifications: Record<string, string>;
  warranty: string;
  sku: string;
  barcode: string;
  variants: string[];
}

export interface VisualIntelligenceSummary {
  appearance: string;
  shape: string;
  color: string;
  design: string;
  logo: string;
  packaging: string;
  visibleFeatures: string[];
  presentation: string;
  imageQuality: string;
  imageCoverage: string;
  background: string;
  confidence: number;
  evidenceRefs: string[];
}

export interface DifferentiatorItem {
  id: string;
  value: string;
  classification: DifferentiatorClass;
  source: string;
  evidence: string;
  confidence: number;
}

export interface BenefitItem {
  id: string;
  benefit: string;
  evidence: string;
  source: string;
  confidence: number;
  classification: FactClassification;
}

export interface InsightItem {
  id: string;
  label: string;
  detail: string;
  evidence: string;
  source: string;
  confidence: number;
  classification: FactClassification;
  freshness?: FreshnessBand;
  date?: string | null;
}

export interface CreativeDirection {
  visualStyle: string;
  mood: string;
  tone: string;
  energy: string;
  productPresentation: string;
  visualEmphasis: string;
  storyDirection: string;
  cameraOpportunities: string[];
  detailOpportunities: string[];
  backgroundDirection: string;
  lightingDirection: string;
  brandFeeling: string;
  note: string;
}

export interface ContentOpportunity {
  id: string;
  name: string;
  targetAudience: string;
  customerNeed: string;
  productFeature: string;
  suggestedAngle: string;
  evidence: string;
  confidence: number;
}

export interface ClaimSafetyEntry {
  id: string;
  claim: string;
  status: ClaimSafetyStatus;
  reason: string;
  source: string;
  confidence: number;
  userDecision: "keep" | "avoid" | "pending";
}

export interface RestrictionItem {
  id: string;
  category: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface MissingInfoItem {
  id: string;
  severity: MissingSeverity;
  detail: string;
  blocksProduction: boolean;
}

export interface SourceRegistryEntry {
  id: string;
  title: string;
  url: string;
  domain: string;
  sourceType: string;
  date: string | null;
  retrievedDate: string;
  quality: string;
  relevantClaims: string[];
  confidence: number;
  freshness: FreshnessBand;
}

export interface SectionConfidence {
  productIdentity: number;
  visualUnderstanding: number;
  productFacts: number;
  productFeatures: number;
  customerIntelligence: number;
  marketIntelligence: number;
  competitiveIntelligence: number;
  marketingInsights: number;
  creativeDirection: number;
  overall: number;
}

export interface MasterIntelligenceScore {
  productIdentity: number;
  visualUnderstanding: number;
  verifiedData: number;
  customerIntelligence: number;
  marketIntelligence: number;
  research: number;
  overall: number;
  explanation: string;
}

export interface PackageRefs {
  projectId: string;
  productId: string;
  productImageSetId: string | null;
  productProfileId: string | null;
  marketingBriefId: string | null;
  researchId: string | null;
  deepIntelligenceId: string | null;
  visualAnalysisId: string | null;
  productionPackageRef: string | null;
}

export interface MasterProductIntelligence {
  version: 1;
  masterId: string;
  versionLabel: string;
  versionNumber: number;
  engineId: string;
  projectId: string;
  productId: string;
  projectName: string;
  productName: string;
  refs: PackageRefs;
  identity: ProductIdentitySummary;
  verifiedFacts: VerifiedFactsBlock;
  visualIntelligence: VisualIntelligenceSummary;
  features: ClassifiedItem[];
  characteristics: ClassifiedItem[];
  variants: ClassifiedItem[];
  specifications: ClassifiedItem[];
  differentiators: DifferentiatorItem[];
  benefits: BenefitItem[];
  customerIntelligence: InsightItem[];
  marketIntelligence: InsightItem[];
  competitiveIntelligence: InsightItem[];
  productKnowledge: ClassifiedItem[];
  marketingInsights: InsightItem[];
  creativeDirection: CreativeDirection;
  contentOpportunities: ContentOpportunity[];
  ctaDirection: string;
  claimSafety: ClaimSafetyEntry[];
  restrictions: RestrictionItem[];
  missingInformation: MissingInfoItem[];
  uncertainty: ClassifiedItem[];
  sources: SourceRegistryEntry[];
  sectionConfidence: SectionConfidence;
  scores: MasterIntelligenceScore;
  phase3Complete: boolean;
  readyForContentProduction: boolean;
  userConfirmed: boolean;
  confirmedAt: string | null;
  history: Array<{ versionLabel: string; masterId: string; createdAt: string; status: MasterPackageStatus }>;
  status: MasterPackageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MasterProgress {
  total: number;
  completed: number;
  percent: number;
  currentLabel: string;
  currentStage: MasterStage | null;
  running: boolean;
}

export interface MasterIntelligenceSnapshot {
  version: 1;
  package: MasterProductIntelligence | null;
  progress: MasterProgress;
  recommendation: string;
  handoffReady: boolean;
  reviewOpen: boolean;
  updatedAt: string;
}

/** Next-phase handoff — does not start content production */
export interface ContentProductionHandoffPayload {
  version: 1;
  step: "ready-for-content-production";
  phase3Complete: true;
  projectId: string;
  projectName: string;
  master: MasterProductIntelligence;
  research: ResearchPackage | null;
  deepIntelligence: ProductIntelligencePackage | null;
  visualAnalysis: VisualProductAnalysisPackage | null;
  productionPackage: ProductionInputPackage | null;
  productProfile: ProductProfile | null;
  marketingBrief: MarketingProductionBrief | null;
  preparedAt: string;
}

export const MASTER_STORE_KEY = "kwizera.master-intelligence.v1";
export const MASTER_HANDOFF_KEY = "kwizera.master-intelligence.handoff.v1";
export const MASTER_MEMORY_KEY = "kwizera.master-intelligence.memory.v1";

export const MASTER_STAGES: MasterStage[] = [
  "loaded",
  "identity",
  "verified-facts",
  "visual",
  "features",
  "differentiators",
  "benefits",
  "customer",
  "market",
  "competitive",
  "knowledge",
  "marketing",
  "creative",
  "opportunities",
  "claim-safety",
  "restrictions",
  "missing",
  "sources",
  "confidence",
  "score",
  "saved",
];

export const MASTER_STAGE_LABELS: Record<MasterStage, string> = {
  loaded: "Inputs loaded",
  identity: "Product identity",
  "verified-facts": "Verified product facts",
  visual: "Visual intelligence",
  features: "Product features",
  differentiators: "Differentiators",
  benefits: "Benefit intelligence",
  customer: "Customer intelligence",
  market: "Market intelligence",
  competitive: "Competitive intelligence",
  knowledge: "Product knowledge",
  marketing: "Marketing insights",
  creative: "Creative direction",
  opportunities: "Content opportunities",
  "claim-safety": "Claim safety register",
  restrictions: "Production restrictions",
  missing: "Missing information",
  sources: "Source registry",
  confidence: "Confidence model",
  score: "Master intelligence score",
  saved: "Draft saved for review",
};
