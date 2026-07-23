import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeTierManager } from "./knowledge-tier-manager.js";
import { KnowledgeDuplicateGroup, KnowledgeDuplicateMergeResult } from "./types.js";
export declare class KnowledgeDeduplicator {
    private readonly foundation;
    private readonly tierManager;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, tierManager: KnowledgeTierManager, logger: KnowledgeOptimizationLogger);
    detectDuplicates(): KnowledgeDuplicateGroup[];
    mergeDuplicates(): Promise<KnowledgeDuplicateMergeResult>;
}
//# sourceMappingURL=knowledge-deduplicator.d.ts.map