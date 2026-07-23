/**
 * KWIZERA AI STUDIO — Knowledge Validation Engine types (Step 4M)
 */
import { KnowledgeSource, KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
export declare enum KnowledgeValidationLevel {
    Draft = "draft",
    PendingValidation = "pending-validation",
    Validated = "validated",
    Trusted = "trusted",
    Archived = "archived",
    Rejected = "rejected"
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
export declare class KnowledgeValidationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const TRUSTED_QUALITY_MIN = 75;
export declare const TRUSTED_CONFIDENCE_MIN = 70;
export declare const TRUSTED_RELIABILITY_MIN = 65;
export declare const TRUSTED_CONSISTENCY_MIN = 70;
export declare const KNOWN_KNOWLEDGE_SOURCES: KnowledgeSource[];
export declare const SOURCE_MODULE_MAP: Record<string, string>;
//# sourceMappingURL=types.d.ts.map