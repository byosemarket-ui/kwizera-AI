import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
export interface KnowledgeResourceMetrics {
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    searchPerformanceMs: number;
    retrievalPerformanceMs: number;
    validationPerformanceMs: number;
}
export declare class KnowledgeResourceMonitor {
    private readonly foundation;
    private readonly storageRoot;
    constructor(foundation: AiKnowledgeFoundation, storageRoot: string);
    measure(): KnowledgeResourceMetrics;
    private dirSize;
}
export declare function deriveKnowledgePerformanceIssues(metrics: KnowledgeResourceMetrics): string[];
//# sourceMappingURL=resource-monitor.d.ts.map