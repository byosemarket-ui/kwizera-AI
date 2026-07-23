import type { VideoGenerationHealthCheckResult, VideoGenerationHealthHistoryEntry, VideoGenerationHealthMonitorStatusReport, MonitoredVideoGenerationModuleHealthScore } from "./types.js";
export declare class VideoGenerationHealthReportGenerator {
    private readonly projectStateDir;
    constructor(projectStateDir: string);
    generateAll(status: VideoGenerationHealthMonitorStatusReport, check: VideoGenerationHealthCheckResult | null, history: VideoGenerationHealthHistoryEntry[], modules: MonitoredVideoGenerationModuleHealthScore[]): {
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