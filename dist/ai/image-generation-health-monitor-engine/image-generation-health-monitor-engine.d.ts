import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationHealthMonitorLogger } from "./health-logger.js";
import { ImageGenerationHealthHistoryStore } from "./health-history-store.js";
import { ImageGenerationAuditResult, ImageGenerationHealthCheckResult, ImageGenerationHealthHistoryEntry, ImageGenerationHealthMonitorStatusReport, MonitoredImageGenerationModuleHealthScore } from "./types.js";
/**
 * AI Image Generation Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire AI Image Generation System.
 */
export declare class AiImageGenerationHealthMonitorEngine {
    private foundation;
    private storageRoot;
    private healthDir;
    private projectStateDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageGenerationHealthMonitorLogger;
    readonly history: ImageGenerationHealthHistoryStore;
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
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string, projectStateDir?: string): void;
    runStartup(): Promise<void>;
    runHealthCheck(): Promise<ImageGenerationHealthCheckResult>;
    runAudit(): Promise<ImageGenerationAuditResult>;
    getModuleScores(): MonitoredImageGenerationModuleHealthScore[];
    getLastCheck(): ImageGenerationHealthCheckResult | null;
    getLastAudit(): ImageGenerationAuditResult | null;
    getHealthHistory(): ImageGenerationHealthHistoryEntry[];
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
    buildStatusReport(): ImageGenerationHealthMonitorStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getHealthDir(): string;
    private ensureReady;
}
//# sourceMappingURL=image-generation-health-monitor-engine.d.ts.map