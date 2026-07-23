import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeHealthMonitorLogger } from "./health-logger.js";
import { KnowledgeAutoRepairResult, KnowledgeHealthWarning } from "./types.js";
export declare class KnowledgeAutoRepairHandler {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeHealthMonitorLogger);
    attemptRepairs(warnings: KnowledgeHealthWarning[]): Promise<KnowledgeAutoRepairResult>;
}
//# sourceMappingURL=auto-repair-handler.d.ts.map