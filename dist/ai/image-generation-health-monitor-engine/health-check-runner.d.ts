import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationAutoRepairHandler } from "./auto-repair-handler.js";
import { ImageGenerationEarlyWarningSystem } from "./early-warning-system.js";
import { ImageGenerationHealthMonitorLogger } from "./health-logger.js";
import { ImageGenerationHealthHistoryStore } from "./health-history-store.js";
import { ImageGenerationModuleHealthChecker } from "./module-health-checker.js";
import { ImageGenerationResourceMonitor } from "./resource-monitor.js";
import { ImageGenerationHealthCheckResult } from "./types.js";
export declare class ImageGenerationHealthCheckRunner {
    private readonly foundation;
    private readonly moduleChecker;
    private readonly resourceMonitor;
    private readonly earlyWarning;
    private readonly autoRepair;
    private readonly history;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, moduleChecker: ImageGenerationModuleHealthChecker, resourceMonitor: ImageGenerationResourceMonitor, earlyWarning: ImageGenerationEarlyWarningSystem, autoRepair: ImageGenerationAutoRepairHandler, history: ImageGenerationHealthHistoryStore, logger: ImageGenerationHealthMonitorLogger);
    runCheck(): Promise<ImageGenerationHealthCheckResult>;
}
//# sourceMappingURL=health-check-runner.d.ts.map