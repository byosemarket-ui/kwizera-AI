import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeHealthScoreLevel, MonitoredKnowledgeModuleHealthScore } from "./types.js";
export declare class KnowledgeModuleHealthChecker {
    private readonly foundation;
    constructor(foundation: AiKnowledgeFoundation);
    checkAll(): MonitoredKnowledgeModuleHealthScore[];
    scoreToLevel(score: number): KnowledgeHealthScoreLevel;
    private checkModule;
}
//# sourceMappingURL=module-health-checker.d.ts.map