import { AiCoreHealthReport, AiCoreStatusReport, AiLifecycleState } from "./types.js";
import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiStartupManager } from "./ai-startup-manager.js";
import type { AiShutdownManager } from "./ai-shutdown-manager.js";
import type { AiConfigurationManager } from "./ai-configuration-manager.js";
import type { AiHealthMonitor } from "./ai-health-monitor.js";
import type { AiRuntime } from "./ai-runtime.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiCoordinator } from "./ai-coordinator.js";
import type { AiSessionManager } from "./ai-session-manager.js";
export interface AiControllerDeps {
    lifecycle: AiLifecycleManager;
    startup: AiStartupManager;
    shutdown: AiShutdownManager;
    configuration: AiConfigurationManager;
    runtime: AiRuntime;
    registry: AiModuleRegistry;
    logger: AiCoreLogger;
    health: AiHealthMonitor;
    coordinator: AiCoordinator;
    sessions: AiSessionManager;
}
/**
 * High-level AI Core controller — start, stop, pause, recover, status.
 */
export declare class AiController {
    private readonly deps;
    constructor(deps: AiControllerDeps);
    getLifecycleState(): AiLifecycleState;
    recover(reason?: string): Promise<void>;
    pause(): void;
    resume(): void;
    getHealthReport(): AiCoreHealthReport;
    buildStatusReport(): AiCoreStatusReport;
}
//# sourceMappingURL=ai-controller.d.ts.map