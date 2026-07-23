import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
export interface VideoIntelligenceResourceMetrics {
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    gpuUsagePercent: number;
    searchPerformanceMs: number;
    planningPerformanceMs: number;
    timelineProcessingMs: number;
    analysisPerformanceMs: number;
}
export declare class VideoIntelligenceResourceMonitor {
    private readonly foundation;
    private readonly storageRoot;
    constructor(foundation: AiVideoIntelligenceFoundation, storageRoot: string);
    measure(): VideoIntelligenceResourceMetrics;
    private dirSize;
}
export declare function deriveVideoIntelligencePerformanceIssues(metrics: VideoIntelligenceResourceMetrics): string[];
//# sourceMappingURL=resource-monitor.d.ts.map