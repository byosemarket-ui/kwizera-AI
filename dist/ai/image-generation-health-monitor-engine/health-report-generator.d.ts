import type { ImageGenerationHealthCheckResult, ImageGenerationHealthHistoryEntry, ImageGenerationHealthMonitorStatusReport, MonitoredImageGenerationModuleHealthScore } from "./types.js";
export declare class ImageGenerationHealthReportGenerator {
    private readonly projectStateDir;
    constructor(projectStateDir: string);
    generateAll(status: ImageGenerationHealthMonitorStatusReport, check: ImageGenerationHealthCheckResult | null, history: ImageGenerationHealthHistoryEntry[], modules: MonitoredImageGenerationModuleHealthScore[]): {
        healthReportPath: string;
        historyReportPath: string;
        performanceReportPath: string;
        recommendationsReportPath: string;
    };
    private buildHealthReport;
    private buildHistoryReport;
    private buildPerformanceReport;
    private buildRecommendationsReport;
}
//# sourceMappingURL=health-report-generator.d.ts.map