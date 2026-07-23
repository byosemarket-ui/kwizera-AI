import type { ImageIntelligenceHealthCheckResult, ImageIntelligenceHealthHistoryEntry, ImageIntelligenceHealthMonitorStatusReport, MonitoredImageIntelligenceModuleHealthScore } from "./types.js";
export declare class ImageIntelligenceHealthReportGenerator {
    private readonly projectStateDir;
    constructor(projectStateDir: string);
    generateAll(status: ImageIntelligenceHealthMonitorStatusReport, check: ImageIntelligenceHealthCheckResult | null, history: ImageIntelligenceHealthHistoryEntry[], modules: MonitoredImageIntelligenceModuleHealthScore[]): {
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