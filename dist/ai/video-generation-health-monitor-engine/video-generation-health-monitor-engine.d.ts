import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationHealthMonitorLogger } from "./health-logger.js";
import { VideoGenerationHealthHistoryStore } from "./health-history-store.js";
import { VideoGenerationAuditResult, VideoGenerationHealthCheckResult, VideoGenerationHealthHistoryEntry, VideoGenerationHealthMonitorStatusReport, MonitoredVideoGenerationModuleHealthScore } from "./types.js";
/**
 * AI Video Generation Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire AI Video Generation System.
 */
export declare class AiVideoGenerationHealthMonitorEngine {
    private foundation;
    private storageRoot;
    private healthDir;
    private projectStateDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoGenerationHealthMonitorLogger;
    readonly history: VideoGenerationHealthHistoryStore;
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
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string, projectStateDir?: string): void;
    runStartup(): Promise<void>;
    runHealthCheck(): Promise<VideoGenerationHealthCheckResult>;
    runAudit(): Promise<VideoGenerationAuditResult>;
    getModuleScores(): MonitoredVideoGenerationModuleHealthScore[];
    getLastCheck(): VideoGenerationHealthCheckResult | null;
    getLastAudit(): VideoGenerationAuditResult | null;
    getHealthHistory(): VideoGenerationHealthHistoryEntry[];
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
    buildStatusReport(): VideoGenerationHealthMonitorStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getHealthDir(): string;
    private ensureReady;
}
//# sourceMappingURL=video-generation-health-monitor-engine.d.ts.map