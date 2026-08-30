import type { CanonicalViewKind } from "../product-record/view-kinds.js";

export type ClaimSource = "CONFIRMED" | "INFERRED" | "USER_DEFINED";
export type BriefStatus = "DRAFT" | "INTELLIGENCE_READY" | "READY_FOR_SCRIPT";
export type AspectRatio = "9:16" | "1:1" | "16:9";
export type RecommendationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EDITED";
export type CampaignObjectiveCode =
  | "PRODUCT_AWARENESS"
  | "SALES"
  | "PRODUCT_LAUNCH"
  | "BRAND_AWARENESS"
  | "PROMOTION"
  | "ENGAGEMENT"
  | "OTHER";

export const MARKETING_BRIEF_VERSION = 1 as const;

export interface ProvenanceClaim {
  text: string;
  source: ClaimSource;
  confidence: number;
  reason?: string;
}

export interface BriefRecommendation {
  id: string;
  field: string;
  label: string;
  value: string | string[];
  why: string;
  source: ClaimSource;
  reasoningBasis: string;
  confidence: number;
  status: RecommendationStatus;
  editedValue?: string | string[];
}

export interface CampaignAudience {
  general: string;
  location: string;
  ageRange: string;
  gender: string;
  customerType: string;
  interests: string[];
}

export interface CampaignSettings {
  objective: string;
  objectiveCode: CampaignObjectiveCode;
  platforms: string[];
  audience: CampaignAudience;
  cta: string;
  tone: string;
  language: string;
  lockedFields: string[];
}

export interface OutputSettings {
  aspectRatio: AspectRatio | "";
  duration: string;
  contentFormat: string;
  pacing: string;
  hookStyle: string;
}

export interface PlatformProductionPreset {
  platform: string;
  suggestedAspectRatio: AspectRatio;
  suggestedDuration: string;
  suggestedContentFormat: string;
  pacing: string;
  hookStyle: string;
  ctaGuidance: string;
}

export interface MarketingIntelligenceBlock {
  category: ProvenanceClaim;
  positioning: ProvenanceClaim;
  productStrengths: ProvenanceClaim[];
  visualStrengths: ProvenanceClaim[];
  detailsWorthShowing: ProvenanceClaim[];
  mainSellingPoint: ProvenanceClaim;
  supportingPoints: ProvenanceClaim[];
  marketingAngle: ProvenanceClaim;
  suggestedObjective: ProvenanceClaim;
  suggestedTone: ProvenanceClaim;
  suggestedContentApproach: ProvenanceClaim;
  suggestedCta: ProvenanceClaim;
  audienceHypotheses: ProvenanceClaim[];
  platformStrategy: ProvenanceClaim;
}

export interface ResolvedMarketingCopy {
  positioning: string;
  angle: string;
  mainSellingPoint: ProvenanceClaim;
  supportingPoints: ProvenanceClaim[];
  message: string;
  cta: string;
}

export interface BriefVersionSnapshot {
  version: number;
  createdAt: string;
  reason: string;
  campaign: CampaignSettings;
  output: OutputSettings;
  marketing: ResolvedMarketingCopy;
  status: BriefStatus;
}

export interface AuthoritativeMarketingBrief {
  version: typeof MARKETING_BRIEF_VERSION;
  briefId: string;
  productId: string;
  projectId: string;
  projectName: string;
  briefVersion: number;
  activeVersion: number;
  createdAt: string;
  updatedAt: string;
  status: BriefStatus;
  campaign: CampaignSettings;
  output: OutputSettings;
  marketing: ResolvedMarketingCopy;
  creative: {
    tone: string;
    style: string;
  };
  productAssets: Partial<Record<CanonicalViewKind | "side" | "details", string[]>>;
  intelligence: MarketingIntelligenceBlock | null;
  recommendations: BriefRecommendation[];
  acceptedRecommendationIds: string[];
  rejectedRecommendationIds: string[];
  versions: BriefVersionSnapshot[];
  userDefined: Record<string, unknown>;
}

export const MATERIAL_BRIEF_FIELDS = [
  "objective",
  "platforms",
  "aspectRatio",
  "contentFormat",
  "duration",
  "cta",
  "tone",
  "mainSellingPoint",
  "message",
] as const;
