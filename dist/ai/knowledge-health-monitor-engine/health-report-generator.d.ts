import type { KnowledgeHealthHistoryEntry } from "./types.js";
import type { KnowledgeHealthCheckResult, KnowledgeHealthMonitorStatusReport, MonitoredKnowledgeModuleHealthScore } from "./types.js";
export declare class KnowledgeHealthReportGenerator {
    private readonly storageRoot;
    constructor(storageRoot: string);
    generateAll(status: KnowledgeHealthMonitorStatusReport, check: KnowledgeHealthCheckResult | null, history: KnowledgeHealthHistoryEntry[], modules: MonitoredKnowledgeModuleHealthScore[]): {
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