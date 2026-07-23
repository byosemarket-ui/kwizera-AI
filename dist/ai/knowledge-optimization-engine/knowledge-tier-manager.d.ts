import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeTier, KnowledgeTierAssignment } from "./types.js";
export declare class KnowledgeTierManager {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    private tiersPath;
    private assignments;
    constructor(foundation: AiKnowledgeFoundation, storageRoot: string, logger: KnowledgeOptimizationLogger);
    initialize(optimizationDir: string): void;
    classifyAll(): KnowledgeTierAssignment[];
    getTier(knowledgeId: string): KnowledgeTierAssignment | undefined;
    getByTier(tier: KnowledgeTier): KnowledgeTierAssignment[];
    getDistribution(): Record<KnowledgeTier, number>;
    markArchived(knowledgeId: string): void;
    getTiersPath(): string;
    private loadUsageStats;
    private daysSince;
    private persist;
}
//# sourceMappingURL=knowledge-tier-manager.d.ts.map