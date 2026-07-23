import type { VideoIntelligenceHealthCheckResult, VideoIntelligenceHealthHistoryEntry, VideoIntelligenceHealthMonitorStatusReport, MonitoredVideoIntelligenceModuleHealthScore } from "./types.js";
export declare class VideoIntelligenceHealthReportGenerator {
    private readonly projectStateDir;
    constructor(projectStateDir: string);
    generateAll(status: VideoIntelligenceHealthMonitorStatusReport, check: VideoIntelligenceHealthCheckResult | null, history: VideoIntelligenceHealthHistoryEntry[], modules: MonitoredVideoIntelligenceModuleHealthScore[]): {
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