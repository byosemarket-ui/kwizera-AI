import { AiModulePlugin, FutureModuleDefinition, ModuleRegistryEntry } from "./types.js";
import type { AiCoreLogger } from "./logger.js";
/** Reserved future module IDs — slots only, no implementations in Step 2A */
export declare const FUTURE_MODULE_IDS: readonly ["memory-engine", "knowledge-engine", "reasoning-engine", "learning-engine", "marketing-engine", "video-engine", "video-generation-engine", "image-generation-engine", "image-engine", "translation-engine", "decision-engine", "planning-engine", "workflow-engine", "task-manager", "product-engine", "search-engine", "export-engine", "recovery-engine", "health-monitor"];
export type FutureModuleId = (typeof FUTURE_MODULE_IDS)[number];
export declare class AiModuleRegistry {
    private readonly entries;
    initializeSlots(definitions: FutureModuleDefinition[], logger: AiCoreLogger): void;
    registerPlugin(plugin: AiModulePlugin, logger: AiCoreLogger): void;
    initializeModule(id: string, logger: AiCoreLogger): Promise<void>;
    shutdownModule(id: string, logger: AiCoreLogger): Promise<void>;
    getEntry(id: string): ModuleRegistryEntry | undefined;
    getPlugin(id: string): AiModulePlugin | undefined;
    getAllEntries(): ModuleRegistryEntry[];
    getRegisteredCount(): number;
    getSlotCount(): number;
    private updateStatus;
}
//# sourceMappingURL=module-registry.d.ts.map