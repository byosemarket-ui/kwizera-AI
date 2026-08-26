/** Phase 4 Step 1 — Master Marketing & Campaign Strategy Engine */

import type { MasterProductIntelligence, ClaimSafetyEntry, RestrictionItem } from "../master-intelligence/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import type { ProductProfile } from "../product-profile/types";
import type { ResearchPackage } from "../market-research/types";

export type StrategyClassification =
  | "VERIFIED"
  | "USER PROVIDED"
  | "RESEARCH SUPPORTED"
  | "AI RECOMMENDATION"
  | "UNKNOWN / NOT PROVIDED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type StrategyStatus =
  | "idle"
  | "running"
  | "draft"
  | "review"
  | "confirmed"
  | "partial";

export type RecDecision = "pending" | "accepted" | "rejected" | "kept-user";

export type StrategyStage =
  | "loaded"
  | "objective"
  | "audience"
  | "problem"
  | "desire"
  | "motivation"
  | "positioning"
  | "value"
  | "usp"
  | "angles"
  | "primary-angle"
  | "message"
  | "benefits"
  | "platform"
  | "language"
  | "voice"
  | "cta"
  | "promotion"
  | "competitive"
  | "content"
  | "creative"
  | "claims"
  | "risks"
  | "confidence"
  | "saved";

export interface LabeledInsight {
  id: string;
  label: string;
  detail: string;
  evidence: string;
  classification: StrategyClassification;
  confidence: number;
}

export interface CampaignObjectiveBlock {
  userObjective: string;
  aiRecommendation: string | null;
  aiReason: string | null;
  recDecision: RecDecision;
  activeObjective: string;
}

export interface AudienceProfile {
  primaryAudience: string;
  secondaryAudience: string;
  ageRange: string;
  location: string;
  interests: string[];
  needs: string;
  painPoints: LabeledInsight[];
  desires: LabeledInsight[];
  buyingMotivation: string;
  buyingConcerns: LabeledInsight[];
  decisionFactors: LabeledInsight[];
}

export interface RankedMotivation {
  id: string;
  rank: number;
  motivation: string;
  confidence: number;
  band: "High" | "Medium" | "Low";
  evidence: string;
  classification: StrategyClassification;
}

export interface PositioningStatement {
  forAudience: string;
  whoNeed: string;
  thisProduct: string;
  provides: string;
  because: string;
  supportedBy: string;
  classification: StrategyClassification;
  confidence: number;
}

export interface ValueProposition {
  statement: string;
  whyCare: string;
  productBenefit: string;
  customerNeed: string;
  evidence: string;
  classification: StrategyClassification;
  confidence: number;
}

export interface UspCandidate {
  id: string;
  statement: string;
  supportingEvidence: string;
  marketRelevance: string;
  customerRelevance: string;
  confidence: number;
  classification: StrategyClassification;
  superiorityClaim: boolean;
}

export interface MarketingAngle {
  id: string;
  name: string;
  customerProblem: string;
  productFeature: string;
  productBenefit: string;
  message: string;
  audience: string;
  evidence: string;
  confidence: number;
  recommendedPlatform: string;
  classification: StrategyClassification;
  rank: number;
}

export interface MessageStrategy {
  mainMessage: string;
  supportingMessages: string[];
  proofPoints: string[];
  emotionalMessage: string;
  functionalMessage: string;
  ctaMessage: string;
  note: string;
}

export interface RankedBenefit {
  id: string;
  role: "PRIMARY" | "SECONDARY" | "SUPPORTING";
  benefit: string;
  evidence: string;
  classification: StrategyClassification;
  confidence: number;
}

export interface PlatformPlan {
  platform: string;
  contentDirection: string;
  messagingIntensity: string;
  ctaEmphasis: string;
  audienceConsideration: string;
  formatConsideration: string;
  durationConsideration: string;
  visualEmphasis: string;
}

export interface LanguageVoiceStrategy {
  language: string;
  voice: string;
  tone: string;
  communicationStyle: string;
  vocabularyLevel: string;
  emotionalTone: string;
  salesIntensity: string;
  professionalism: string;
  note: string;
}

export interface CtaStrategy {
  userCta: string;
  aligned: boolean;
  alignmentNote: string;
  aiRecommendation: string | null;
  recDecision: RecDecision;
  activeCta: string;
}

export interface PromotionStrategy {
  configured: boolean;
  type: string;
  details: string;
  status: "CONFIGURED" | "NO PROMOTION CONFIGURED";
  aiRecommendation: string | null;
  recDecision: RecDecision;
}

export interface CompetitivePositioning {
  commonMessages: string[];
  commonClaims: string[];
  commonValueProps: string[];
  differentiationOpportunities: LabeledInsight[];
  note: string;
}

export interface ContentDirection {
  primary: string;
  alternatives: string[];
  note: string;
}

export interface CreativeStrategy {
  visualMood: string;
  emotionalMood: string;
  energy: string;
  productPresentation: string;
  visualEmphasis: string;
  brandFeeling: string;
  storytellingStyle: string;
  cameraStyleDirection: string;
  audioStyleDirection: string;
  note: string;
}

export interface ClaimBuckets {
  approved: ClaimSafetyEntry[];
  requiringReview: ClaimSafetyEntry[];
  unverified: ClaimSafetyEntry[];
  prohibited: ClaimSafetyEntry[];
}

export interface MarketingRisk {
  id: string;
  title: string;
  detail: string;
  level: RiskLevel;
}

export interface StrategyConfidence {
  audience: number;
  productPositioning: number;
  marketingAngle: number;
  marketContext: number;
  campaignClarity: number;
  evidenceQuality: number;
  overall: number;
  explanation: string;
}

export interface StrategyRefs {
  projectId: string;
  productId: string;
  masterIntelligenceId: string | null;
  marketingBriefId: string | null;
  researchPackageId: string | null;
}

export interface MasterMarketingStrategy {
  version: 1;
  strategyId: string;
  versionLabel: string;
  versionNumber: number;
  engineId: string;
  projectId: string;
  productId: string;
  projectName: string;
  productName: string;
  refs: StrategyRefs;
  objective: CampaignObjectiveBlock;
  audience: AudienceProfile;
  customerProblem: LabeledInsight;
  customerDesire: LabeledInsight[];
  buyingMotivations: RankedMotivation[];
  positioning: PositioningStatement;
  valueProposition: ValueProposition;
  uspCandidates: UspCandidate[];
  angles: MarketingAngle[];
  primaryAngleId: string | null;
  message: MessageStrategy;
  benefits: RankedBenefit[];
  platforms: PlatformPlan[];
  languageVoice: LanguageVoiceStrategy;
  cta: CtaStrategy;
  promotion: PromotionStrategy;
  competitive: CompetitivePositioning;
  contentDirection: ContentDirection;
  creative: CreativeStrategy;
  claims: ClaimBuckets;
  restrictions: RestrictionItem[];
  risks: MarketingRisk[];
  confidence: StrategyConfidence;
  keepUserSettings: boolean;
  userConfirmed: boolean;
  confirmedAt: string | null;
  readyForCreativePlanning: boolean;
  history: Array<{ versionLabel: string; strategyId: string; createdAt: string; status: StrategyStatus }>;
  status: StrategyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyProgress {
  total: number;
  completed: number;
  percent: number;
  currentLabel: string;
  currentStage: StrategyStage | null;
  running: boolean;
}

export interface MarketingStrategySnapshot {
  version: 1;
  package: MasterMarketingStrategy | null;
  progress: StrategyProgress;
  recommendation: string;
  handoffReady: boolean;
  reviewOpen: boolean;
  updatedAt: string;
}

/** Step 2 handoff — does not start story/script generation */
export interface Step2CreativePlannerHandoffPayload {
  version: 1;
  step: "step-2-story-script-creative-planner";
  projectId: string;
  projectName: string;
  strategy: MasterMarketingStrategy;
  master: MasterProductIntelligence | null;
  marketingBrief: MarketingProductionBrief | null;
  productProfile: ProductProfile | null;
  research: ResearchPackage | null;
  claimSafety: ClaimSafetyEntry[];
  productionRestrictions: RestrictionItem[];
  preparedAt: string;
}

export const STRATEGY_STORE_KEY = "kwizera.marketing-strategy.v1";
export const STRATEGY_HANDOFF_KEY = "kwizera.marketing-strategy.handoff.v1";
export const STRATEGY_MEMORY_KEY = "kwizera.marketing-strategy.memory.v1";

export const STRATEGY_STAGES: StrategyStage[] = [
  "loaded",
  "objective",
  "audience",
  "problem",
  "desire",
  "motivation",
  "positioning",
  "value",
  "usp",
  "angles",
  "primary-angle",
  "message",
  "benefits",
  "platform",
  "language",
  "voice",
  "cta",
  "promotion",
  "competitive",
  "content",
  "creative",
  "claims",
  "risks",
  "confidence",
  "saved",
];

export const STRATEGY_STAGE_LABELS: Record<StrategyStage, string> = {
  loaded: "Inputs loaded",
  objective: "Campaign objective",
  audience: "Target audience",
  problem: "Customer problem",
  desire: "Customer desire",
  motivation: "Buying motivation",
  positioning: "Product positioning",
  value: "Value proposition",
  usp: "USP candidates",
  angles: "Marketing angles",
  "primary-angle": "Primary angle",
  message: "Message strategy",
  benefits: "Benefit prioritization",
  platform: "Platform strategy",
  language: "Language strategy",
  voice: "Voice strategy",
  cta: "CTA strategy",
  promotion: "Promotion strategy",
  competitive: "Competitive positioning",
  content: "Content direction",
  creative: "Creative strategy",
  claims: "Claim safety",
  risks: "Marketing risks",
  confidence: "Strategy confidence",
  saved: "Draft saved for review",
};
