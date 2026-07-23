import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIntelligenceAutoRepairHandler } from "./auto-repair-handler.js";
import { VideoIntelligenceEarlyWarningSystem } from "./early-warning-system.js";
import { VideoIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { VideoIntelligenceHealthHistoryStore } from "./health-history-store.js";
import { VideoIntelligenceModuleHealthChecker } from "./module-health-checker.js";
import { VideoIntelligenceResourceMonitor } from "./resource-monitor.js";
import { VideoIntelligenceHealthCheckResult } from "./types.js";
export declare class VideoIntelligenceHealthCheckRunner {
    private readonly foundation;
    private readonly moduleChecker;
    private readonly resourceMonitor;
    private readonly earlyWarning;
    private readonly autoRepair;
    private readonly history;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, moduleChecker: VideoIntelligenceModuleHealthChecker, resourceMonitor: VideoIntelligenceResourceMonitor, earlyWarning: VideoIntelligenceEarlyWarningSystem, autoRepair: VideoIntelligenceAutoRepairHandler, history: VideoIntelligenceHealthHistoryStore, logger: VideoIntelligenceHealthMonitorLogger);
    runCheck(): Promise<VideoIntelligenceHealthCheckResult>;
}
//# sourceMappingURL=health-check-runner.d.ts.map