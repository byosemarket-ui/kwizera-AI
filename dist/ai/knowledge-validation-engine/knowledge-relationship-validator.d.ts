import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import { KnowledgeValidationLogger } from "./validation-logger.js";
import { KnowledgeRelationshipValidationResult } from "./types.js";
export declare class KnowledgeRelationshipValidator {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeValidationLogger);
    validateRecord(record: KnowledgeRecord): {
        valid: boolean;
        issues: string[];
    };
    validateAll(repair?: boolean): Promise<KnowledgeRelationshipValidationResult>;
}
//# sourceMappingURL=knowledge-relationship-validator.d.ts.map