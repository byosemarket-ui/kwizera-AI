import type { MonitoredProductIntelligenceModuleHealthScore, ProductIntelligenceHealthCheckResult, ProductIntelligenceHealthHistoryEntry, ProductIntelligenceHealthMonitorStatusReport } from "./types.js";
export declare class ProductIntelligenceHealthReportGenerator {
    private readonly projectStateDir;
    constructor(projectStateDir: string);
    generateAll(status: ProductIntelligenceHealthMonitorStatusReport, check: ProductIntelligenceHealthCheckResult | null, history: ProductIntelligenceHealthHistoryEntry[], modules: MonitoredProductIntelligenceModuleHealthScore[]): {
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