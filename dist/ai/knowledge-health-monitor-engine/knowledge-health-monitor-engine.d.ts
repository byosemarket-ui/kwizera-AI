import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeHealthMonitorLogger } from "./health-logger.js";
import { KnowledgeHealthHistoryStore } from "./health-history-store.js";
import { KnowledgeAuditResult, KnowledgeHealthCheckResult, KnowledgeHealthHistoryEntry, KnowledgeHealthMonitorStatusReport, KnowledgeTrendAnalysis, MonitoredKnowledgeModuleHealthScore } from "./types.js";
/**
 * Knowledge Health Monitor — continuously monitors the complete knowledge system.
 */
export declare class AiKnowledgeHealthMonitorEngine {
    private foundation;
    private storageRoot;
    private healthDir;
    private initialized;
    private startupComplete;
    readonly logger: KnowledgeHealthMonitorLogger;
    readonly history: KnowledgeHealthHistoryStore;
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
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    runHealthCheck(): Promise<KnowledgeHealthCheckResult>;
    runAudit(): Promise<KnowledgeAuditResult>;
    getModuleScores(): MonitoredKnowledgeModuleHealthScore[];
    getLastCheck(): KnowledgeHealthCheckResult | null;
    getLastAudit(): KnowledgeAuditResult | null;
    getHealthHistory(): KnowledgeHealthHistoryEntry[];
    getTrendAnalysis(): KnowledgeTrendAnalysis;
    generateReports(): {
        healthReportPath: string;
        historyReportPath: string;
        performanceReportPath: string;
        recommendationsReportPath: string;
    };
    buildStatusReport(): KnowledgeHealthMonitorStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getHealthDir(): string;
    private ensureReady;
}
//# sourceMappingURL=knowledge-health-monitor-engine.d.ts.map