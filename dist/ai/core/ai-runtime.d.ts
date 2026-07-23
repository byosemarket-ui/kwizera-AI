import { AiCoreConfiguration } from "./types.js";
import type { AiCoreLogger } from "./logger.js";
import type { AiContextManager } from "./ai-context-manager.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiSessionManager } from "./ai-session-manager.js";
export interface AiRuntimeState {
    initialized: boolean;
    preparedAt?: string;
    workflowReady: boolean;
}
/**
 * Lightweight runtime shell — no business logic, no future module dependencies.
 */
export declare class AiRuntime {
    private state;
    prepare(config: AiCoreConfiguration, contextManager: AiContextManager, logger: AiCoreLogger): void;
    getState(): Readonly<AiRuntimeState>;
    isInitialized(): boolean;
    isWorkflowReady(): boolean;
    reset(): void;
}
export type { AiModuleRegistry, AiSessionManager };
//# sourceMappingURL=ai-runtime.d.ts.map