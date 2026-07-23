import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { AutoRepairHandler } from "./auto-repair-handler.js";
import { EarlyWarningSystem } from "./early-warning-system.js";
import { MemoryHealthMonitorLogger } from "./health-logger.js";
import { HealthHistoryStore } from "./health-history-store.js";
import { ModuleHealthChecker } from "./module-health-checker.js";
import { ResourceMonitor } from "./resource-monitor.js";
import { MemoryHealthCheckResult } from "./types.js";
export declare class HealthCheckRunner {
    private readonly foundation;
    private readonly moduleChecker;
    private readonly resourceMonitor;
    private readonly earlyWarning;
    private readonly autoRepair;
    private readonly history;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, moduleChecker: ModuleHealthChecker, resourceMonitor: ResourceMonitor, earlyWarning: EarlyWarningSystem, autoRepair: AutoRepairHandler, history: HealthHistoryStore, logger: MemoryHealthMonitorLogger);
    runCheck(): Promise<MemoryHealthCheckResult>;
}
//# sourceMappingURL=health-check-runner.d.ts.map