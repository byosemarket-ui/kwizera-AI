import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationAutoRepairHandler } from "./auto-repair-handler.js";
import { VideoGenerationEarlyWarningSystem } from "./early-warning-system.js";
import { VideoGenerationHealthMonitorLogger } from "./health-logger.js";
import { VideoGenerationHealthHistoryStore } from "./health-history-store.js";
import { VideoGenerationModuleHealthChecker } from "./module-health-checker.js";
import { VideoGenerationResourceMonitor } from "./resource-monitor.js";
import { VideoGenerationHealthCheckResult } from "./types.js";
export declare class VideoGenerationHealthCheckRunner {
    private readonly foundation;
    private readonly moduleChecker;
    private readonly resourceMonitor;
    private readonly earlyWarning;
    private readonly autoRepair;
    private readonly history;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, moduleChecker: VideoGenerationModuleHealthChecker, resourceMonitor: VideoGenerationResourceMonitor, earlyWarning: VideoGenerationEarlyWarningSystem, autoRepair: VideoGenerationAutoRepairHandler, history: VideoGenerationHealthHistoryStore, logger: VideoGenerationHealthMonitorLogger);
    runCheck(): Promise<VideoGenerationHealthCheckResult>;
}
//# sourceMappingURL=health-check-runner.d.ts.map