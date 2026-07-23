import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ProductIntelligenceHealthHistoryStore } from "./health-history-store.js";
import { MonitoredProductIntelligenceModuleHealthScore, ProductIntelligenceAuditResult, ProductIntelligenceHealthCheckResult, ProductIntelligenceHealthHistoryEntry, ProductIntelligenceHealthMonitorStatusReport, ProductIntelligenceTrendAnalysis } from "./types.js";
/**
 * Product Intelligence Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire Product Intelligence System.
 */
export declare class AiProductIntelligenceHealthMonitorEngine {
    private foundation;
    private storageRoot;
    private healthDir;
    private projectStateDir;
    private initialized;
    private startupComplete;
    readonly logger: ProductIntelligenceHealthMonitorLogger;
    readonly history: ProductIntelligenceHealthHistoryStore;
    private moduleChecker;
    private resourceMonitor;
    private earlyWarning;
    private autoRepair;
    private checkRunner;
    private auditor;
    private reportGenerator;
    private trendAnalyzer;
    private lastCheck;
    private lastAudit;
    private checkTimes;
    private totalWarnings;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string, projectStateDir?: string): void;
    runStartup(): Promise<void>;
    runHealthCheck(): Promise<ProductIntelligenceHealthCheckResult>;
    runAudit(): Promise<ProductIntelligenceAuditResult>;
    getModuleScores(): MonitoredProductIntelligenceModuleHealthScore[];
    getLastCheck(): ProductIntelligenceHealthCheckResult | null;
    getLastAudit(): ProductIntelligenceAuditResult | null;
    getHealthHistory(): ProductIntelligenceHealthHistoryEntry[];
    getTrendAnalysis(): ProductIntelligenceTrendAnalysis;
    generateReports(): {
        healthReportPath: string;
        historyReportPath: string;
        performanceReportPath: string;
        recommendationsReportPath: string;
    };
    buildStatusReport(): ProductIntelligenceHealthMonitorStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getHealthDir(): string;
    private ensureReady;
}
//# sourceMappingURL=product-intelligence-health-monitor-engine.d.ts.map