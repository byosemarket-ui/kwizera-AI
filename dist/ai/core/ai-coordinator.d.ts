import { AiModulePlugin } from "./types.js";
import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiSessionManager } from "./ai-session-manager.js";
import type { AiContextManager } from "./ai-context-manager.js";
/**
 * Coordinates communication between AI Core subsystems and future modules.
 * No business logic — routing and lifecycle coordination only.
 */
export declare class AiCoordinator {
    private readonly lifecycle;
    private readonly registry;
    private readonly sessions;
    private readonly context;
    private readonly logger;
    constructor(lifecycle: AiLifecycleManager, registry: AiModuleRegistry, sessions: AiSessionManager, context: AiContextManager, logger: AiCoreLogger);
    ensureOperational(): void;
    registerFutureModule(plugin: AiModulePlugin): Promise<void>;
    beginSession(metadata?: Record<string, unknown>): string;
    endSession(sessionId: string): void;
    getRegistrySnapshot(): import("./types.js").ModuleRegistryEntry[];
}
//# sourceMappingURL=ai-coordinator.d.ts.map