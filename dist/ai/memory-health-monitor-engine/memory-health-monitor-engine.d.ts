import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryHealthMonitorLogger } from "./health-logger.js";
import { HealthHistoryStore } from "./health-history-store.js";
import { MemoryHealthCheckResult, HealthHistoryEntry, MemoryAuditResult, MemoryHealthMonitorStatusReport, MonitoredModuleHealthScore, TrendAnalysis } from "./types.js";
/**
 * Memory Health Monitor — continuously monitors the complete memory system.
 */
export declare class AiMemoryHealthMonitorEngine {
    private foundation;
    private storageRoot;
    private healthDir;
    private initialized;
    private startupComplete;
    readonly logger: MemoryHealthMonitorLogger;
    readonly history: HealthHistoryStore;
    private moduleChecker;
    private resourceMonitor;
    private earlyWarning;
    private autoRepair;
    private checkRunner;
    private auditor;
    private trendAnalyzer;
    private lastCheck;
    private lastAudit;
    private checkTimes;
    private totalWarnings;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    runHealthCheck(): Promise<MemoryHealthCheckResult>;
    runAudit(): Promise<MemoryAuditResult>;
    getModuleScores(): MonitoredModuleHealthScore[];
    getLastCheck(): MemoryHealthCheckResult | null;
    getLastAudit(): MemoryAuditResult | null;
    getHealthHistory(): HealthHistoryEntry[];
    getTrendAnalysis(): TrendAnalysis;
    buildStatusReport(): MemoryHealthMonitorStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getHealthDir(): string;
    private ensureReady;
}
//# sourceMappingURL=memory-health-monitor-engine.d.ts.map