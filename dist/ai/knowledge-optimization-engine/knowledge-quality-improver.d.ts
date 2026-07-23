import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeQualityImprovementResult } from "./types.js";
export declare class KnowledgeQualityImprover {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeOptimizationLogger);
    improve(): Promise<KnowledgeQualityImprovementResult>;
}
//# sourceMappingURL=knowledge-quality-improver.d.ts.map