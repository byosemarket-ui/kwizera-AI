import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeValidationLogger } from "./validation-logger.js";
import { KnowledgeConsistencyValidationResult } from "./types.js";
export declare class KnowledgeConsistencyValidator {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeValidationLogger);
    validateAll(repair?: boolean): Promise<KnowledgeConsistencyValidationResult>;
    rejectInvalidRecords(): Promise<number>;
}
//# sourceMappingURL=knowledge-consistency-validator.d.ts.map