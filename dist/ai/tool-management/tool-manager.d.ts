import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { RegisteredTool, ToolDefinition, ToolExecutionRequest, ToolExecutionResult, ToolHandler, ToolHealth } from "./types.js";
/** Central local-first registry and permission-gated executor for KWIZERA capabilities. */
export declare class AiToolManager {
    private root;
    private core;
    private readonly tools;
    private readonly handlers;
    private initialized;
    initialize(core: AiCoreManager, storageRoot: string): Promise<void>;
    isInitialized(): boolean;
    list(category?: RegisteredTool["category"]): RegisteredTool[];
    get(toolId: string): RegisteredTool | null;
    register(definition: ToolDefinition, handler: ToolHandler, configuration?: Record<string, unknown>): Promise<RegisteredTool>;
    discover(tools: Array<{
        definition: ToolDefinition;
        handler: ToolHandler;
        configuration?: Record<string, unknown>;
    }>): Promise<number>;
    remove(toolId: string): Promise<void>;
    update(toolId: string, changes: Partial<Pick<ToolDefinition, "name" | "description" | "version" | "dependencies" | "supportedModels">>): Promise<RegisteredTool>;
    enable(toolId: string): Promise<void>;
    disable(toolId: string): Promise<void>;
    load(toolId: string): Promise<void>;
    unload(toolId: string): Promise<void>;
    configure(toolId: string, configuration: Record<string, unknown>): Promise<RegisteredTool>;
    validate(toolId: string): {
        valid: boolean;
        errors: string[];
    };
    execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
    monitor(toolId?: string): Promise<Record<string, ToolHealth>>;
    getIntegrationStatus(): Record<string, boolean>;
    private record;
    private validateInput;
    private validateDefinition;
    private require;
    private ensureReady;
    private restore;
    private persist;
}
//# sourceMappingURL=tool-manager.d.ts.map