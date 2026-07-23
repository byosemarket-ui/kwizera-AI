import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeConsistencyValidator } from "./knowledge-consistency-validator.js";
import { KnowledgeIntegrityValidator } from "./knowledge-integrity-validator.js";
import { KnowledgeRelationshipValidator } from "./knowledge-relationship-validator.js";
import { KnowledgeSourceValidator } from "./knowledge-source-validator.js";
import { KnowledgeValidationLogger } from "./validation-logger.js";
import { KnowledgeBatchValidationResult, KnowledgeRecordValidationResult, KnowledgeRepairResult, KnowledgeValidationLevel } from "./types.js";
export declare class KnowledgeValidationRunner {
    private readonly foundation;
    private readonly sourceValidator;
    private readonly relationshipValidator;
    private readonly consistencyValidator;
    private readonly integrityValidator;
    private readonly logger;
    private readonly statePath;
    private readonly structureValidator;
    private readonly versionValidator;
    private readonly qualityScorer;
    private validationState;
    constructor(foundation: AiKnowledgeFoundation, sourceValidator: KnowledgeSourceValidator, relationshipValidator: KnowledgeRelationshipValidator, consistencyValidator: KnowledgeConsistencyValidator, integrityValidator: KnowledgeIntegrityValidator, logger: KnowledgeValidationLogger, statePath: string);
    validateRecord(knowledgeId: string): Promise<KnowledgeRecordValidationResult>;
    validateAll(): Promise<KnowledgeBatchValidationResult>;
    repairSafeIssues(): Promise<KnowledgeRepairResult>;
    getValidationResult(knowledgeId: string): KnowledgeRecordValidationResult | undefined;
    getAllResults(): KnowledgeRecordValidationResult[];
    isTrusted(knowledgeId: string): boolean;
    getValidationLevel(knowledgeId: string): KnowledgeValidationLevel;
    private resolveValidationLevel;
    private buildResult;
    private loadState;
    private persistState;
}
//# sourceMappingURL=knowledge-validation-runner.d.ts.map