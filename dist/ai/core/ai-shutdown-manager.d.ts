import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiContextManager } from "./ai-context-manager.js";
import type { AiRuntime } from "./ai-runtime.js";
import type { AiSessionManager } from "./ai-session-manager.js";
export interface AiShutdownManagerDeps {
    lifecycle: AiLifecycleManager;
    logger: AiCoreLogger;
    context: AiContextManager;
    runtime: AiRuntime;
    sessions: AiSessionManager;
}
export declare class AiShutdownManager {
    shutdown(deps: AiShutdownManagerDeps, reason?: string): Promise<void>;
}
//# sourceMappingURL=ai-shutdown-manager.d.ts.map