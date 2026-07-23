import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeAnalysisReport } from "./types.js";
export declare class KnowledgeAnalyzer {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeOptimizationLogger);
    analyze(): Promise<KnowledgeAnalysisReport>;
    computeAverageQuality(): {
        qualityScore: number;
        completeness: number;
    };
}
//# sourceMappingURL=knowledge-analyzer.d.ts.map