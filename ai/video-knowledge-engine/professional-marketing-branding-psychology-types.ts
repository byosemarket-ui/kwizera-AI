/**
 * Professional Marketing, Branding, Customer & Sales Psychology — Expansion Step 7 types.
 * Learning/organization only — does not create advertisements automatically.
 */

export const PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION = "1.0.0";
export const MARKETING_DOMAIN_ID = "marketing-knowledge";
export const BRANDING_DOMAIN_ID = "branding-knowledge";
export const CUSTOMER_PSYCHOLOGY_DOMAIN_ID = "customer-psychology";
export const SALES_PSYCHOLOGY_DOMAIN_ID = "sales-psychology";
export const MARKETING_BRANDING_PSYCHOLOGY_SOURCE = "professional-marketing-branding-psychology-knowledge";

export type MarketingTopicId =
  | "marketing-fundamentals"
  | "digital-marketing"
  | "product-marketing"
  | "content-marketing"
  | "video-marketing"
  | "social-media-marketing"
  | "influencer-marketing"
  | "performance-marketing"
  | "marketing-funnel"
  | "marketing-customer-journey"
  | "lead-generation"
  | "conversion-optimization";

export type BrandingTopicId =
  | "brand-identity"
  | "brand-positioning"
  | "brand-awareness"
  | "brand-trust"
  | "brand-consistency"
  | "brand-voice"
  | "brand-story"
  | "brand-guidelines"
  | "logo-usage"
  | "visual-identity";

export type CustomerPsychologyTopicId =
  | "customer-behavior"
  | "buying-motivation"
  | "emotional-triggers"
  | "trust-building"
  | "decision-making"
  | "attention-psychology"
  | "product-perception"
  | "consumer-expectations"
  | "customer-satisfaction"
  | "customer-retention";

export type SalesPsychologyTopicId =
  | "persuasion-principles"
  | "value-proposition"
  | "urgency"
  | "scarcity"
  | "social-proof"
  | "authority"
  | "reciprocity"
  | "cta-strategy"
  | "offer-presentation"
  | "objection-handling";

export type VideoMarketingTopicId =
  | "hook-creation"
  | "first-3-seconds-strategy"
  | "audience-retention"
  | "product-demonstration"
  | "feature-presentation"
  | "benefit-presentation"
  | "video-cta-placement"
  | "ending-strategy";

export type MbpTopicId =
  | MarketingTopicId
  | BrandingTopicId
  | CustomerPsychologyTopicId
  | SalesPsychologyTopicId
  | VideoMarketingTopicId;

export type MbpRelatedDomainId =
  | "marketing-knowledge"
  | "branding-knowledge"
  | "customer-psychology"
  | "sales-psychology"
  | "storytelling-knowledge"
  | "video-production-knowledge"
  | "video-editing-knowledge"
  | "product-knowledge"
  | "social-media-knowledge"
  | "rendering-knowledge";

export interface ProfessionalMbpTopic {
  topicId: MbpTopicId;
  knowledgeId: string;
  name: string;
  title: string;
  description: string;
  professionalDefinition: string;
  purpose: string;
  bestPractices: string[];
  commonMistakes: string[];
  workflow: string[];
  professionalExamples: string[];
  relatedTopics: MbpTopicId[];
  relatedDomains: MbpRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId:
      | typeof MARKETING_DOMAIN_ID
      | typeof BRANDING_DOMAIN_ID
      | typeof CUSTOMER_PSYCHOLOGY_DOMAIN_ID
      | typeof SALES_PSYCHOLOGY_DOMAIN_ID;
    category:
      | "professional-marketing"
      | "professional-branding"
      | "professional-customer-psychology"
      | "professional-sales-psychology"
      | "professional-video-marketing";
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 7;
    version: typeof PROFESSIONAL_MARKETING_BRANDING_PSYCHOLOGY_VERSION;
    learningOnly: true;
    createsAdvertisements: false;
  };
}

export interface MbpDomainBridge {
  domainId: MbpRelatedDomainId;
  knowledgeId: string;
  title: string;
  description: string;
  relationshipEvidence: string;
}

export interface AiMeMbpAwareness {
  canRecommendMarketingStrategies: boolean;
  canRecommendBrandingStrategies: boolean;
  canExplainCustomerPsychology: boolean;
  canExplainSalesPsychology: boolean;
  canRecommendCtas: boolean;
  canRecommendProductPresentation: boolean;
  canAnswerQuestions: boolean;
  marketingTopicCount: number;
  brandingTopicCount: number;
  customerPsychologyTopicCount: number;
  salesPsychologyTopicCount: number;
  videoMarketingTopicCount: number;
  relationshipCount: number;
  averageConfidence: number;
  averageQuality: number;
  marketingDomainReady: boolean;
  brandingDomainReady: boolean;
  customerPsychologyDomainReady: boolean;
  salesPsychologyDomainReady: boolean;
  summary: string;
}

export interface MbpHealthReport {
  healthy: boolean;
  completenessScore: number;
  missingConcepts: string[];
  missingMarketingConcepts: string[];
  missingBrandingConcepts: string[];
  missingCustomerPsychologyConcepts: string[];
  missingSalesPsychologyConcepts: string[];
  duplicateKnowledge: string[];
  brokenRelationships: string[];
  issues: string[];
}

export interface MbpRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface MbpInstallResult {
  installed: boolean;
  marketingInstalled: number;
  marketingUpdated: number;
  brandingInstalled: number;
  brandingUpdated: number;
  customerPsychologyInstalled: number;
  customerPsychologyUpdated: number;
  salesPsychologyInstalled: number;
  salesPsychologyUpdated: number;
  videoMarketingInstalled: number;
  videoMarketingUpdated: number;
  bridgesInstalled: number;
  relationshipsCreated: number;
  marketingPackSynced: boolean;
  brandingPackSynced: boolean;
  customerPsychologyPackSynced: boolean;
  salesPsychologyPackSynced: boolean;
  domainsMarkedReady: boolean;
  issues: string[];
}

export interface MbpRecommendation {
  available: boolean;
  topicId: string | null;
  name: string;
  reason: string;
  bestPractices: string[];
  workflow: string[];
  confidenceScore: number;
  alternatives: Array<{ name: string; reason: string }>;
  kind: "marketing" | "branding" | "customer-psychology" | "sales-psychology" | "video-marketing" | "cta" | "product-presentation" | "none";
}

export interface MbpExplainResult {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  explanation: string;
  bestPractices: string[];
  confidenceScore: number;
  qualityScore: number;
  kind: "marketing" | "branding" | "customer-psychology" | "sales-psychology" | "video-marketing" | "none";
}

export class ProfessionalMbpError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalMbpError";
  }
}
