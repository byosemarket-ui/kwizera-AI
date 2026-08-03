import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiToolManager } from "../tool-management/tool-manager.js";
import { type PluginExecutionRequest, type PluginExecutionResult, type PluginFactory, type PluginHealth, type PluginManifest, type RegisteredPlugin } from "./types.js";
export declare const PLATFORM_VERSION = "0.1.0";
/** Manifest-driven local extension manager. Only trusted, compiled factories are executable. */
export declare class AiPluginManager {
    private root;
    private core;
    private tools;
    private initialized;
    private readonly plugins;
    private readonly factories;
    private readonly runtimes;
    private readonly logs;
    initialize(core: AiCoreManager, tools: AiToolManager, storageRoot: string): Promise<void>;
    isInitialized(): boolean;
    list(): RegisteredPlugin[];
    get(pluginId: string): RegisteredPlugin | null;
    getLogs(): ReadonlyArray<{
        at: string;
        event: string;
        pluginId?: string;
        detail: string;
    }>;
    install(manifest: PluginManifest, factory: PluginFactory): Promise<RegisteredPlugin>;
    discover(plugins: Array<{
        manifest: PluginManifest;
        factory: PluginFactory;
    }>): Promise<number>;
    initializePlugin(pluginId: string): Promise<void>;
    load(pluginId: string): Promise<void>;
    unload(pluginId: string): Promise<void>;
    enable(pluginId: string): Promise<void>;
    disable(pluginId: string): Promise<void>;
    shutdown(): Promise<void>;
    pause(pluginId: string): Promise<void>;
    resume(pluginId: string): Promise<void>;
    remove(pluginId: string): Promise<void>;
    update(pluginId: string, version: string): Promise<RegisteredPlugin>;
    configure(pluginId: string, configuration: Record<string, unknown>): Promise<RegisteredPlugin>;
    validate(pluginId: string): {
        valid: boolean;
        errors: string[];
    };
    execute(request: PluginExecutionRequest): Promise<PluginExecutionResult>;
    monitor(pluginId?: string): Promise<Record<string, PluginHealth>>;
    getIntegrationStatus(): Record<string, boolean>;
    private sandbox;
    private record;
    private validatePlugin;
    private validateManifest;
    private isCompatible;
    private validatePermissions;
    private require;
    private ensureReady;
    private log;
    private restore;
    private persist;
}
//# sourceMappingURL=plugin-manager.d.ts.map