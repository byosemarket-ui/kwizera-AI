import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
export interface ImageIntelligenceResourceMetrics {
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    searchPerformanceMs: number;
    planningPerformanceMs: number;
    relationshipDetectionMs: number;
}
export declare class ImageIntelligenceResourceMonitor {
    private readonly foundation;
    private readonly storageRoot;
    constructor(foundation: AiImageIntelligenceFoundation, storageRoot: string);
    measure(): ImageIntelligenceResourceMetrics;
    private dirSize;
}
export declare function deriveImageIntelligencePerformanceIssues(metrics: ImageIntelligenceResourceMetrics): string[];
//# sourceMappingURL=resource-monitor.d.ts.map