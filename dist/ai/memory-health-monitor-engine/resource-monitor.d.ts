import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MonitoredModuleHealthScore } from "./types.js";
export interface ResourceMetrics {
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    readPerformanceMs: number;
    writePerformanceMs: number;
    searchPerformanceMs: number;
    retrievalPerformanceMs: number;
}
export declare class ResourceMonitor {
    private readonly foundation;
    private readonly storageRoot;
    constructor(foundation: AiMemoryFoundation, storageRoot: string);
    measure(): ResourceMetrics;
    private dirSize;
}
export declare function derivePerformanceIssues(metrics: ResourceMetrics, moduleScores: MonitoredModuleHealthScore[]): string[];
//# sourceMappingURL=resource-monitor.d.ts.map