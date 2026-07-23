import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import { KnowledgeValidationLogger } from "./validation-logger.js";
import { KnowledgeSourceValidationResult } from "./types.js";
export declare class KnowledgeSourceValidator {
    private readonly foundation;
    private readonly logger;
    private static readonly MODULE_ENGINE_SOURCES;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeValidationLogger);
    validateSource(source: string): KnowledgeSourceValidationResult;
    validateRecordSource(record: KnowledgeRecord): KnowledgeSourceValidationResult;
    private resolveModuleForSource;
}
//# sourceMappingURL=knowledge-source-validator.d.ts.map