/** Phase 3 Step 2 — Deep Product Intelligence & Cross-Validation */

import type { ProductProfile, ProductVariant } from "../product-profile/types";
import type { VisualProductAnalysisPackage } from "../visual-analysis/types";
import type { ProductionInputPackage } from "../product-validation/types";

export type FactKind = "verified" | "ai-observation" | "ai-inference";
export type ReviewStatus = "pending" | "accepted" | "rejected" | "reviewed" | "keep-user";
export type ConsistencyMark = "consistent" | "conflict" | "not-visually-verified" | "uncertain";
export type ConfidenceBand = "high" | "medium" | "low";

export type IntelligenceStage =
  | "loaded"
  | "identity"
  | "cross-validation"
  | "features"
  | "characteristics"
  | "differentiators"
  | "benefits"
  | "variants"
  | "specifications"
  | "logo-text"
  | "consistency"
  | "uncertainty"
  | "score"
  | "saved";

export interface EvidenceRef {
  assetId: string | null;
  fileName: string | null;
  location: string | null;
  detection: string;
  confidence: number;
  engineId: string;
  at: string;
}

export interface LayeredItem {
  id: string;
  field: string;
  value: string;
  kind: FactKind;
  confidence: number;
  band: ConfidenceBand;
  reason: string;
  evidence: EvidenceRef[];
  reviewStatus: ReviewStatus;
}

export interface IdentityField {
  field: string;
  userValue: string;
  visualValue: string;
  mark: ConsistencyMark;
  confidence: number;
}

export interface CrossCheck {
  id: string;
  field: string;
  userValue: string;
  visualValue: string;
  mark: ConsistencyMark;
  confidence: number;
  detail: string;
  reviewStatus: ReviewStatus;
}

export interface VariantCheck {
  kind: ProductVariant["kind"];
  label: string;
  declared: string;
  visualSupport: string | null;
  status: "visually-supported" | "user-provided-not-visually-verified";
}

export interface IntelligenceScores {
  identity: number;
  visualUnderstanding: number;
  specificationSupport: number;
  imageCoverage: number;
  consistency: number;
  overall: number;
  explanation: string;
}

export interface IntelligenceVersionMeta {
  versionLabel: string;
  versionNumber: number;
  intelligenceId: string;
  overallScore: number;
  createdAt: string;
}

export interface ProductIntelligencePackage {
  version: 1;
  intelligenceId: string;
  versionLabel: string;
  versionNumber: number;
  engineId: string;
  projectId: string;
  productId: string;
  projectName: string;
  productName: string;
  visualAnalysisId: string | null;
  productionPackageRef: string | null;
  identity: IdentityField[];
  verifiedFacts: LayeredItem[];
  visualObservations: LayeredItem[];
  inferences: LayeredItem[];
  features: LayeredItem[];
  characteristics: LayeredItem[];
  differentiators: LayeredItem[];
  benefits: LayeredItem[];
  unknown: LayeredItem[];
  variants: VariantCheck[];
  specificationChecks: CrossCheck[];
  logoTextChecks: CrossCheck[];
  crossValidation: CrossCheck[];
  consistency: {
    product: ConsistencyMark;
    images: ConsistencyMark;
    specifications: ConsistencyMark;
    variants: ConsistencyMark;
    note: string;
    confidence: number;
  };
  coverage: VisualProductAnalysisPackage["coverage"];
  coveragePercent: number;
  scores: IntelligenceScores;
  warnings: Array<{ id: string; code: string; title: string; detail: string; severity: "info" | "warning" | "critical" }>;
  history: IntelligenceVersionMeta[];
  status: "idle" | "running" | "complete" | "partial";
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceProgress {
  total: number;
  completed: number;
  percent: number;
  currentLabel: string;
  currentStage: IntelligenceStage | null;
  running: boolean;
}

export interface DeepIntelligenceSnapshot {
  version: 1;
  package: ProductIntelligencePackage | null;
  progress: IntelligenceProgress;
  recommendation: string;
  handoffReady: boolean;
  serviceAvailable: boolean;
  updatedAt: string;
}

export interface Step3MarketIntelHandoffPayload {
  version: 1;
  step: "step-3-market-customer-intelligence";
  projectId: string;
  projectName: string;
  masterIntelligence: ProductIntelligencePackage;
  visualAnalysis: VisualProductAnalysisPackage | null;
  productionPackage: ProductionInputPackage | null;
  productProfile: ProductProfile | null;
  preparedAt: string;
}

export const INTEL_STORE_KEY = "kwizera.deep-intelligence.v1";
export const INTEL_HANDOFF_KEY = "kwizera.deep-intelligence.handoff.v1";

export const INTEL_STAGES: IntelligenceStage[] = [
  "loaded",
  "identity",
  "cross-validation",
  "features",
  "characteristics",
  "differentiators",
  "benefits",
  "variants",
  "specifications",
  "logo-text",
  "consistency",
  "uncertainty",
  "score",
  "saved",
];

export const INTEL_STAGE_LABELS: Record<IntelligenceStage, string> = {
  loaded: "Inputs loaded",
  identity: "Product identity",
  "cross-validation": "Cross-validating profile vs visual evidence",
  features: "Feature intelligence",
  characteristics: "Characteristics",
  differentiators: "Possible differentiators",
  benefits: "Benefit signals",
  variants: "Variant intelligence",
  specifications: "Specification cross-check",
  "logo-text": "Logo and text cross-validation",
  consistency: "Consistency engine",
  uncertainty: "Limitations and unknowns",
  score: "Intelligence score",
  saved: "Result saved",
};
