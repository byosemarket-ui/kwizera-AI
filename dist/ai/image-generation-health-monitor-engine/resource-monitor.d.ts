import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
export interface ImageGenerationResourceMetrics {
    diskUsageMb: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    gpuUsagePercent: number;
    searchPerformanceMs: number;
    planningPerformanceMs: number;
    validationPerformanceMs: number;
    optimizationPerformanceMs: number;
}
export declare class ImageGenerationResourceMonitor {
    private readonly foundation;
    private readonly storageRoot;
    constructor(foundation: AiImageGenerationFoundation, storageRoot: string);
    measure(): ImageGenerationResourceMetrics;
    private dirSize;
}
export declare function deriveImageGenerationPerformanceIssues(metrics: ImageGenerationResourceMetrics): string[];
//# sourceMappingURL=resource-monitor.d.ts.map