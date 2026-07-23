import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeAutoRepairHandler } from "./auto-repair-handler.js";
import { KnowledgeEarlyWarningSystem } from "./early-warning-system.js";
import { KnowledgeHealthMonitorLogger } from "./health-logger.js";
import { KnowledgeHealthHistoryStore } from "./health-history-store.js";
import { KnowledgeModuleHealthChecker } from "./module-health-checker.js";
import { KnowledgeResourceMonitor } from "./resource-monitor.js";
import { KnowledgeHealthCheckResult } from "./types.js";
export declare class KnowledgeHealthCheckRunner {
    private readonly foundation;
    private readonly moduleChecker;
    private readonly resourceMonitor;
    private readonly earlyWarning;
    private readonly autoRepair;
    private readonly history;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, moduleChecker: KnowledgeModuleHealthChecker, resourceMonitor: KnowledgeResourceMonitor, earlyWarning: KnowledgeEarlyWarningSystem, autoRepair: KnowledgeAutoRepairHandler, history: KnowledgeHealthHistoryStore, logger: KnowledgeHealthMonitorLogger);
    runCheck(): Promise<KnowledgeHealthCheckResult>;
}
//# sourceMappingURL=health-check-runner.d.ts.map