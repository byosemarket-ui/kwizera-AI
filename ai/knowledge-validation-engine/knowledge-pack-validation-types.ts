/**
 * Knowledge Pack Validation & Professional Certification types (Knowledge Seeding Step 6).
 * Certifies packs offline — does not import into permanent Knowledge Foundation (Step 7).
 */

import type { KnowledgePackSlug } from "../knowledge-processing-engine/knowledge-extraction-types.js";

export type KnowledgePackCertificationStatus =
  | "pending"
  | "improved"
  | "certified"
  | "rejected"
  | "needs-improvement";

export interface KnowledgePackQualityScores {
  qualityScore: number;
  confidenceScore: number;
  completenessScore: number;
  professionalReadinessScore: number;
  consistencyScore: number;
}

export interface KnowledgePackQualityFindings {
  duplicates: string[];
  conflicts: string[];
  missingConcepts: string[];
  missingWorkflows: string[];
  weakExplanations: string[];
  lowConfidence: string[];
  inconsistentTerminology: string[];
  invalidRelationships: string[];
}

export interface KnowledgePackValidationChecks {
  completeness: boolean;
  professionalAccuracy: boolean;
  technicalAccuracy: boolean;
  logicalConsistency: boolean;
  knowledgeRelationships: boolean;
  metadataCompleteness: boolean;
  workflowCompleteness: boolean;
  decisionRules: boolean;
  examples: boolean;
  bestPractices: boolean;
}

export interface KnowledgePackValidationResult {
  packId: string;
  packSlug: KnowledgePackSlug;
  packVersion: number;
  valid: boolean;
  certified: boolean;
  status: KnowledgePackCertificationStatus;
  scores: KnowledgePackQualityScores;
  checks: KnowledgePackValidationChecks;
  findings: KnowledgePackQualityFindings;
  improvements: string[];
  issues: string[];
  warnings: string[];
  foundationImportDeferred: true;
  validatedAt: string;
}

export interface AiMePackValidationAwareness {
  totalValidated: number;
  certified: number;
  rejected: number;
  needsImprovement: number;
  averageQuality: number;
  averageConfidence: number;
  averageCompleteness: number;
  averageProfessionalReadiness: number;
  canExplain: boolean;
  canCompare: boolean;
  canRecommend: boolean;
  canApplyDecisionRules: boolean;
  summary: string;
}

export interface KnowledgePackValidationRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface KnowledgePackValidationReportData {
  generatedAt: string;
  existingValidationCapability: string[];
  componentsUpgraded: string[];
  componentsCreated: string[];
  packsValidated: Array<{ packSlug: string; status: string; certified: boolean }>;
  qualityScores: { average: number; min: number; max: number };
  confidenceScores: { average: number; min: number; max: number };
  completenessScores: { average: number; min: number; max: number };
  certifiedPacks: string[];
  aiMeValidation: string;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingWorkBeforeStep7: string[];
}

export class KnowledgePackValidationError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "KnowledgePackValidationError";
  }
}

/** Minimum scores for professional certification (pack-level). */
export const PACK_CERT_QUALITY_MIN = 75;
export const PACK_CERT_CONFIDENCE_MIN = 70;
export const PACK_CERT_COMPLETENESS_MIN = 70;
export const PACK_CERT_READINESS_MIN = 72;
export const PACK_CERT_CONSISTENCY_MIN = 65;
