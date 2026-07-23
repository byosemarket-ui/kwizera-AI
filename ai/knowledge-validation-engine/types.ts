/**
 * KWIZERA AI STUDIO — Knowledge Validation Engine types (Step 4M)
 */

import { KnowledgeSource, KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";

export enum KnowledgeValidationLevel {
  Draft = "draft",
  PendingValidation = "pending-validation",
  Validated = "validated",
  Trusted = "trusted",
  Archived = "archived",
  Rejected = "rejected",
}

export interface KnowledgeQualityScores {
  qualityScore: number;
  reliabilityScore: number;
  completenessScore: number;
  consistencyScore: number;
  confidenceScore: number;
}

export interface KnowledgeRecordValidationResult {
  knowledgeId: string;
  valid: boolean;
  validationLevel: KnowledgeValidationLevel;
  verificationStatus: KnowledgeVerificationStatus;
  trusted: boolean;
  scores: KnowledgeQualityScores;
  structureValid: boolean;
  sourceValid: boolean;
  versionValid: boolean;
  relationshipValid: boolean;
  metadataValid: boolean;
  issues: string[];
  warnings: string[];
  repairs: string[];
  durationMs: number;
}

export interface KnowledgeSourceValidationResult {
  source: string;
  valid: boolean;
  trusted: boolean;
  moduleId?: string;
  issues: string[];
}

export interface KnowledgeRelationshipValidationResult {
  valid: boolean;
  relationshipsChecked: number;
  brokenReferences: number;
  orphanRecords: number;
  issuesRepaired: number;
  diagnostics: string[];
  durationMs: number;
}

export interface KnowledgeConsistencyValidationResult {
  valid: boolean;
  duplicateGroups: number;
  conflictingRecords: number;
  orphanRecords: number;
  invalidReferences: number;
  repairsApplied: number;
  diagnostics: string[];
  durationMs: number;
}

export interface KnowledgeIntegrityValidationResult {
  valid: boolean;
  recordsChecked: number;
  corruptedRecords: number;
  checksumFailures: number;
  versionIntegrityFailures: number;
  diagnostics: string[];
  durationMs: number;
}

export interface KnowledgeBatchValidationResult {
  totalRecords: number;
  validRecords: number;
  trustedRecords: number;
  rejectedRecords: number;
  repairedRecords: number;
  results: KnowledgeRecordValidationResult[];
  durationMs: number;
}

export interface KnowledgeRepairResult {
  repaired: number;
  rejected: number;
  diagnostics: string[];
  durationMs: number;
}

export interface KnowledgeValidationStatusReport {
  engineStatus: string;
  knowledgeValidationStatus: string;
  qualityStatus: string;
  integrityStatus: string;
  relationshipValidationStatus: string;
  totalValidations: number;
  trustedCount: number;
  rejectedCount: number;
  performance: {
    averageValidationMs: number;
    lastValidationMs: number;
    lastBatchMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class KnowledgeValidationEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "KnowledgeValidationEngineError";
  }
}

export const TRUSTED_QUALITY_MIN = 75;
export const TRUSTED_CONFIDENCE_MIN = 70;
export const TRUSTED_RELIABILITY_MIN = 65;
export const TRUSTED_CONSISTENCY_MIN = 70;

export const KNOWN_KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  KnowledgeSource.MemoryEngine,
  KnowledgeSource.LearningEngine,
  KnowledgeSource.Project,
  KnowledgeSource.Product,
  KnowledgeSource.Video,
  KnowledgeSource.MarketingCampaign,
  KnowledgeSource.UserPreference,
  KnowledgeSource.ReasoningHistory,
  KnowledgeSource.DecisionHistory,
  KnowledgeSource.KnowledgeModule,
  KnowledgeSource.Manual,
  KnowledgeSource.System,
];

export const SOURCE_MODULE_MAP: Record<string, string> = {
  [KnowledgeSource.MemoryEngine]: "memory-engine",
  [KnowledgeSource.LearningEngine]: "learning-memory-engine",
  [KnowledgeSource.Product]: "product-knowledge",
  [KnowledgeSource.Video]: "video-knowledge",
  [KnowledgeSource.MarketingCampaign]: "marketing-knowledge",
  [KnowledgeSource.KnowledgeModule]: "knowledge-module",
  [KnowledgeStorageType.Image]: "image-knowledge",
  [KnowledgeStorageType.Brand]: "brand-knowledge",
  [KnowledgeStorageType.Language]: "language-knowledge",
  [KnowledgeStorageType.Creative]: "creative-knowledge",
};
