import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeValidationLogger } from "./validation-logger.js";
import { KnowledgeIntegrityValidationResult } from "./types.js";
export declare class KnowledgeIntegrityValidator {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeValidationLogger);
    validateAll(): Promise<KnowledgeIntegrityValidationResult>;
    quarantineCorruptRecords(): Promise<number>;
}
//# sourceMappingURL=knowledge-integrity-validator.d.ts.map