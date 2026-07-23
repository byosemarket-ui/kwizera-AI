import { AiInitializationDiagnostic } from "./types.js";
import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiConfigurationManager } from "./ai-configuration-manager.js";
import type { AiContextManager } from "./ai-context-manager.js";
import type { AiRuntime } from "./ai-runtime.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiSessionManager } from "./ai-session-manager.js";
import type { AiHealthMonitor } from "./ai-health-monitor.js";
export interface AiStartupManagerDeps {
    lifecycle: AiLifecycleManager;
    logger: AiCoreLogger;
    configuration: AiConfigurationManager;
    context: AiContextManager;
    runtime: AiRuntime;
    registry: AiModuleRegistry;
    sessions: AiSessionManager;
    health: AiHealthMonitor;
}
export declare class AiStartupManager {
    private diagnostics;
    getDiagnostics(): ReadonlyArray<AiInitializationDiagnostic>;
    private record;
    start(deps: AiStartupManagerDeps, options?: {
        storageRootOverride?: string;
        correlationId?: string;
    }): Promise<void>;
}
//# sourceMappingURL=ai-startup-manager.d.ts.map