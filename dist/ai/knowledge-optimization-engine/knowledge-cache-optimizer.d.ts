import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeTierManager } from "./knowledge-tier-manager.js";
import { KnowledgeCacheOptimizationResult } from "./types.js";
export declare class KnowledgeCacheOptimizer {
    private readonly foundation;
    private readonly tierManager;
    private readonly logger;
    private priorityPath;
    constructor(foundation: AiKnowledgeFoundation, tierManager: KnowledgeTierManager, logger: KnowledgeOptimizationLogger);
    initialize(optimizationDir: string): void;
    optimize(): Promise<KnowledgeCacheOptimizationResult>;
    getPriorityPath(): string;
}
//# sourceMappingURL=knowledge-cache-optimizer.d.ts.map