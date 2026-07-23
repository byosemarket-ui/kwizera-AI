import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ImageIntelligenceHealthHistoryStore } from "./health-history-store.js";
import { ImageIntelligenceAuditResult, ImageIntelligenceHealthCheckResult, ImageIntelligenceHealthHistoryEntry, ImageIntelligenceHealthMonitorStatusReport, MonitoredImageIntelligenceModuleHealthScore } from "./types.js";
/**
 * Image Intelligence Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire Image Intelligence System.
 */
export declare class AiImageIntelligenceHealthMonitorEngine {
    private foundation;
    private storageRoot;
    private healthDir;
    private projectStateDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageIntelligenceHealthMonitorLogger;
    readonly history: ImageIntelligenceHealthHistoryStore;
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
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string, projectStateDir?: string): void;
    runStartup(): Promise<void>;
    runHealthCheck(): Promise<ImageIntelligenceHealthCheckResult>;
    runAudit(): Promise<ImageIntelligenceAuditResult>;
    getModuleScores(): MonitoredImageIntelligenceModuleHealthScore[];
    getLastCheck(): ImageIntelligenceHealthCheckResult | null;
    getLastAudit(): ImageIntelligenceAuditResult | null;
    getHealthHistory(): ImageIntelligenceHealthHistoryEntry[];
    getTrendAnalysis(): {
        direction: "improving" | "stable" | "declining";
        averageScore: number;
        scoreChange: number;
        warningTrend: number;
        prediction: string;
    };
    generateReports(): {
        healthReportPath: string;
        historyReportPath: string;
        performanceReportPath: string;
        recommendationsReportPath: string;
    };
    buildStatusReport(): ImageIntelligenceHealthMonitorStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getHealthDir(): string;
    private ensureReady;
}
//# sourceMappingURL=image-intelligence-health-monitor-engine.d.ts.map