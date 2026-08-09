/**
 * Industry Best Practices, Professional Standards & Quality Rules — Expansion Step 9 types.
 * Learning and quality guidance only — does not generate media or certify work automatically.
 */

export const PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION = "1.0.0";
export const INDUSTRY_STANDARDS_DOMAIN_ID = "industry-standards-knowledge";
export const INDUSTRY_STANDARDS_QUALITY_SOURCE = "professional-industry-standards-quality-knowledge";

export type ProfessionalStandardsTopicId =
  | "industry-standards"
  | "production-standards"
  | "quality-assurance"
  | "professional-workflows"
  | "creative-workflows"
  | "technical-standards"
  | "delivery-standards"
  | "review-process"
  | "approval-process";

export type QualityRulesTopicId =
  | "video-quality-rules"
  | "image-quality-rules"
  | "audio-quality-rules"
  | "lighting-quality-rules"
  | "camera-quality-rules"
  | "editing-quality-rules"
  | "rendering-quality-rules"
  | "storytelling-quality-rules"
  | "marketing-quality-rules";

export type ProfessionalBestPracticesTopicId =
  | "planning-best-practices"
  | "production-best-practices"
  | "editing-best-practices"
  | "rendering-best-practices"
  | "branding-best-practices"
  | "product-photography-best-practices"
  | "social-media-best-practices"
  | "content-optimization-best-practices";

export type QualityEvaluationTopicId =
  | "visual-quality-evaluation"
  | "audio-quality-evaluation"
  | "story-quality-evaluation"
  | "technical-quality-evaluation"
  | "marketing-effectiveness-evaluation"
  | "user-experience-evaluation"
  | "content-consistency-evaluation"
  | "brand-consistency-evaluation";

export type ProfessionalChecklistTopicId =
  | "pre-production-checklist"
  | "production-checklist"
  | "post-production-checklist"
  | "publishing-checklist"
  | "quality-review-checklist"
  | "final-approval-checklist";

export type IsqTopicId =
  | ProfessionalStandardsTopicId
  | QualityRulesTopicId
  | ProfessionalBestPracticesTopicId
  | QualityEvaluationTopicId
  | ProfessionalChecklistTopicId;

export type IsqRelatedDomainId =
  | "industry-standards-knowledge"
  | "video-production-knowledge"
  | "camera-knowledge"
  | "lighting-knowledge"
  | "storytelling-knowledge"
  | "animation-knowledge"
  | "rendering-knowledge"
  | "video-editing-knowledge"
  | "marketing-knowledge"
  | "social-media-knowledge"
  | "branding-knowledge"
  | "product-knowledge";

export type IsqCategory =
  | "professional-industry-standards"
  | "professional-quality-rules"
  | "professional-best-practices"
  | "professional-quality-evaluation"
  | "professional-checklists";

export interface ProfessionalIsqTopic {
  topicId: IsqTopicId;
  knowledgeId: string;
  name: string;
  title: string;
  description: string;
  professionalDefinition: string;
  purpose: string;
  bestPractices: string[];
  commonMistakes: string[];
  qualityRules: string[];
  workflow: string[];
  professionalExamples: string[];
  relatedTopics: IsqTopicId[];
  relatedDomains: IsqRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId: typeof INDUSTRY_STANDARDS_DOMAIN_ID;
    category: IsqCategory;
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 9;
    version: typeof PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION;
    learningOnly: true;
    generatesMedia: false;
    certifiesKnowledge: false;
  };
}

export interface IsqDomainBridge {
  domainId: IsqRelatedDomainId;
  knowledgeId: string;
  title: string;
  description: string;
  relationshipEvidence: string;
}

export interface AiMeIndustryStandardsAwareness {
  canEvaluateProfessionalQuality: boolean;
  canRecommendImprovements: boolean;
  canDetectQualityProblems: boolean;
  canExplainIndustryStandards: boolean;
  canRecommendBestPractices: boolean;
  canAnswerProfessionalQualityQuestions: boolean;
  standardsTopicCount: number;
  qualityRulesTopicCount: number;
  bestPracticesTopicCount: number;
  qualityEvaluationTopicCount: number;
  checklistTopicCount: number;
  relationshipCount: number;
  averageConfidence: number;
  averageQuality: number;
  industryStandardsDomainReady: boolean;
  summary: string;
}

export interface IsqHealthReport {
  healthy: boolean;
  completenessScore: number;
  missingConcepts: string[];
  missingStandardsConcepts: string[];
  missingQualityRulesConcepts: string[];
  missingBestPracticesConcepts: string[];
  missingQualityEvaluationConcepts: string[];
  missingChecklistConcepts: string[];
  duplicateKnowledge: string[];
  brokenRelationships: string[];
  issues: string[];
}

export interface IsqRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface IsqInstallResult {
  installed: boolean;
  standardsInstalled: number;
  standardsUpdated: number;
  qualityRulesInstalled: number;
  qualityRulesUpdated: number;
  bestPracticesInstalled: number;
  bestPracticesUpdated: number;
  qualityEvaluationInstalled: number;
  qualityEvaluationUpdated: number;
  checklistsInstalled: number;
  checklistsUpdated: number;
  bridgesInstalled: number;
  relationshipsCreated: number;
  industryStandardsPackSynced: boolean;
  domainMarkedReady: boolean;
  issues: string[];
}

export interface IsqRecommendation {
  available: boolean;
  topicId: string | null;
  name: string;
  reason: string;
  bestPractices: string[];
  qualityRules: string[];
  workflow: string[];
  confidenceScore: number;
  alternatives: Array<{ name: string; reason: string }>;
  kind: "standards" | "quality-rules" | "best-practices" | "evaluation" | "checklist" | "none";
}

export interface IsqQualityEvaluation {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  scope: string;
  evaluationCriteria: string[];
  detectedRisks: string[];
  recommendedImprovements: string[];
  confidenceScore: number;
  qualityScore: number;
  kind: "quality-rules" | "evaluation" | "checklist" | "none";
}

export interface IsqExplainResult {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  explanation: string;
  bestPractices: string[];
  qualityRules: string[];
  confidenceScore: number;
  qualityScore: number;
  kind: "standards" | "quality-rules" | "best-practices" | "evaluation" | "checklist" | "none";
}

export class ProfessionalIndustryStandardsQualityError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalIndustryStandardsQualityError";
  }
}
