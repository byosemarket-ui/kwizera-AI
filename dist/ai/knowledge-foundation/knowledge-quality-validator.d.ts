import { KnowledgeQualityMetadata, KnowledgeValidationResult } from "./types.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeRegistry } from "./knowledge-registry.js";
export declare class KnowledgeQualityValidator {
    private readonly logger;
    private readonly registry;
    private validationTimes;
    constructor(logger: KnowledgeFoundationLogger, registry: KnowledgeRegistry);
    validateMetadata(metadata: KnowledgeQualityMetadata): KnowledgeValidationResult;
    validateModule(knowledgeId: string): KnowledgeValidationResult;
    getAverageValidationMs(): number;
}
//# sourceMappingURL=knowledge-quality-validator.d.ts.map