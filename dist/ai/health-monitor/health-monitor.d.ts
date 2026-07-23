import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { HealthHistoryStore } from "./health-history-store.js";
import { HealthMonitorLogger } from "./health-logger.js";
import { HealthDashboardData, HealthMonitorStatusReport, HealthRecommendation } from "./types.js";
/**
 * AI Health Monitor — continuous health, stability, performance and availability monitoring.
 */
export declare class AiSystemHealthMonitor {
    private core;
    private moduleManager;
    private stateManager;
    private communicationBus;
    private recoveryEngine;
    private storageRoot;
    private initialized;
    readonly logger: HealthMonitorLogger;
    readonly history: HealthHistoryStore;
    private readonly scorer;
    private readonly resources;
    private readonly responseTimes;
    private readonly alerts;
    private readonly automaticActions;
    private readonly dashboardBuilder;
    private runner;
    private lastDashboard;
    private lastRecommendations;
    private scanCount;
    private totalScanMs;
    initialize(core: AiCoreManager, storageRoot: string, moduleManager?: AiModuleManager, stateManager?: AiStateManager, communicationBus?: AiCommunicationBus, recoveryEngine?: AiRecoveryEngine): void;
    isInitialized(): boolean;
    runHealthScan(): Promise<HealthDashboardData>;
    getDashboardData(): HealthDashboardData | null;
    getMonitoredComponentCount(): number;
    getLastRecommendations(): HealthRecommendation[];
    buildStatusReport(): HealthMonitorStatusReport;
    private averageResponseTime;
    private createDeps;
    private ensureReady;
}
//# sourceMappingURL=health-monitor.d.ts.map