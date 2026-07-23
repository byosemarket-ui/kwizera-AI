import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeResourceMetrics } from "./resource-monitor.js";
import { KnowledgeHealthWarning, MonitoredKnowledgeModuleHealthScore } from "./types.js";
export declare class KnowledgeEarlyWarningSystem {
    private readonly foundation;
    constructor(foundation: AiKnowledgeFoundation);
    detect(moduleScores: MonitoredKnowledgeModuleHealthScore[], metrics: KnowledgeResourceMetrics): Promise<KnowledgeHealthWarning[]>;
    private warn;
}
//# sourceMappingURL=early-warning-system.d.ts.map