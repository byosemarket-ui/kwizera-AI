import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeValidationLogger } from "./validation-logger.js";
import { KnowledgeBatchValidationResult, KnowledgeConsistencyValidationResult, KnowledgeIntegrityValidationResult, KnowledgeRecordValidationResult, KnowledgeRelationshipValidationResult, KnowledgeRepairResult, KnowledgeSourceValidationResult, KnowledgeValidationLevel, KnowledgeValidationStatusReport } from "./types.js";
/**
 * Knowledge Validation Engine — verifies accuracy, consistency, and trustworthiness of all knowledge.
 */
export declare class AiKnowledgeValidationEngine {
    private foundation;
    private storageRoot;
    private validationDir;
    private initialized;
    private startupComplete;
    readonly logger: KnowledgeValidationLogger;
    private sourceValidator;
    private relationshipValidator;
    private consistencyValidator;
    private integrityValidator;
    private runner;
    private reportGenerator;
    private validationTimes;
    private totalValidations;
    private lastValidationMs;
    private lastBatchMs;
    private readonly activeValidations;
    private batchValidationActive;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    validateKnowledge(knowledgeId: string): Promise<KnowledgeRecordValidationResult>;
    validateAll(): Promise<KnowledgeBatchValidationResult>;
    validateSource(source: string): KnowledgeSourceValidationResult;
    validateRelationships(repair?: boolean): Promise<KnowledgeRelationshipValidationResult>;
    validateConsistency(repair?: boolean): Promise<KnowledgeConsistencyValidationResult>;
    validateIntegrity(): Promise<KnowledgeIntegrityValidationResult>;
    quarantineCorruptRecords(): Promise<number>;
    repairSafeIssues(): Promise<KnowledgeRepairResult>;
    rejectInvalidKnowledge(): Promise<number>;
    isTrusted(knowledgeId: string): boolean;
    getValidationLevel(knowledgeId: string): KnowledgeValidationLevel;
    generateReports(): Promise<{
        validationReportPath: string;
        qualityReportPath: string;
        integrityReportPath: string;
    }>;
    handleKnowledgeChange(knowledgeId: string, operation: "create" | "update"): Promise<void>;
    buildStatusReport(): KnowledgeValidationStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private revalidateOnChange;
    private recordValidationTiming;
    private ensureReady;
}
//# sourceMappingURL=knowledge-validation-engine.d.ts.map