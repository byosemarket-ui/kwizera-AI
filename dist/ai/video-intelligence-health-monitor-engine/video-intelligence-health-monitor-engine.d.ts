import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { VideoIntelligenceHealthHistoryStore } from "./health-history-store.js";
import { VideoIntelligenceAuditResult, VideoIntelligenceHealthCheckResult, VideoIntelligenceHealthHistoryEntry, VideoIntelligenceHealthMonitorStatusReport, MonitoredVideoIntelligenceModuleHealthScore } from "./types.js";
/**
 * Video Intelligence Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire Video Intelligence System.
 */
export declare class AiVideoIntelligenceHealthMonitorEngine {
    private foundation;
    private storageRoot;
    private healthDir;
    private projectStateDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoIntelligenceHealthMonitorLogger;
    readonly history: VideoIntelligenceHealthHistoryStore;
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
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string, projectStateDir?: string): void;
    runStartup(): Promise<void>;
    runHealthCheck(): Promise<VideoIntelligenceHealthCheckResult>;
    runAudit(): Promise<VideoIntelligenceAuditResult>;
    getModuleScores(): MonitoredVideoIntelligenceModuleHealthScore[];
    getLastCheck(): VideoIntelligenceHealthCheckResult | null;
    getLastAudit(): VideoIntelligenceAuditResult | null;
    getHealthHistory(): VideoIntelligenceHealthHistoryEntry[];
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
    buildStatusReport(): VideoIntelligenceHealthMonitorStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getHealthDir(): string;
    private ensureReady;
}
//# sourceMappingURL=video-intelligence-health-monitor-engine.d.ts.map