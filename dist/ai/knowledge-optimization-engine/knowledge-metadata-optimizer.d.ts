import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
export declare class KnowledgeMetadataOptimizer {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeOptimizationLogger);
    optimize(): Promise<{
        optimized: number;
        bytesSaved: number;
        durationMs: number;
    }>;
    private cleanPayload;
}
//# sourceMappingURL=knowledge-metadata-optimizer.d.ts.map