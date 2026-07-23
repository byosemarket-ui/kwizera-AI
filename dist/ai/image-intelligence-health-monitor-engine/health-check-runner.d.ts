import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceAutoRepairHandler } from "./auto-repair-handler.js";
import { ImageIntelligenceEarlyWarningSystem } from "./early-warning-system.js";
import { ImageIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ImageIntelligenceHealthHistoryStore } from "./health-history-store.js";
import { ImageIntelligenceModuleHealthChecker } from "./module-health-checker.js";
import { ImageIntelligenceResourceMonitor } from "./resource-monitor.js";
import { ImageIntelligenceHealthCheckResult } from "./types.js";
export declare class ImageIntelligenceHealthCheckRunner {
    private readonly foundation;
    private readonly moduleChecker;
    private readonly resourceMonitor;
    private readonly earlyWarning;
    private readonly autoRepair;
    private readonly history;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, moduleChecker: ImageIntelligenceModuleHealthChecker, resourceMonitor: ImageIntelligenceResourceMonitor, earlyWarning: ImageIntelligenceEarlyWarningSystem, autoRepair: ImageIntelligenceAutoRepairHandler, history: ImageIntelligenceHealthHistoryStore, logger: ImageIntelligenceHealthMonitorLogger);
    runCheck(): Promise<ImageIntelligenceHealthCheckResult>;
}
//# sourceMappingURL=health-check-runner.d.ts.map