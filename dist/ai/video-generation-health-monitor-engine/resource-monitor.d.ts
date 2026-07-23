import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
export interface VideoGenerationResourceMetrics {
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    gpuUsagePercent: number;
    searchPerformanceMs: number;
    planningPerformanceMs: number;
    validationPerformanceMs: number;
    optimizationPerformanceMs: number;
}
export declare class VideoGenerationResourceMonitor {
    private readonly foundation;
    private readonly storageRoot;
    constructor(foundation: AiVideoGenerationFoundation, storageRoot: string);
    measure(): VideoGenerationResourceMetrics;
    private dirSize;
}
export declare function deriveVideoGenerationPerformanceIssues(metrics: VideoGenerationResourceMetrics): string[];
//# sourceMappingURL=resource-monitor.d.ts.map