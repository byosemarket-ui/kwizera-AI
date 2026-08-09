import {
  AiModulePlugin,
  FutureModuleDefinition,
  ModuleRegistryEntry,
  ModuleRegistrationStatus,
} from "./types.js";
import type { AiCoreLogger } from "./logger.js";

/** Reserved future module IDs — slots only, no implementations in Step 2A */
export const FUTURE_MODULE_IDS = [
  "memory-engine",
  "knowledge-engine",
  "reasoning-engine",
  "learning-engine",
  "marketing-engine",
  "video-engine",
  "video-generation-engine",
  "image-generation-engine",
  "image-engine",
  "translation-engine",
  "decision-engine",
  "planning-engine",
  "workflow-engine",
  "recommendation-engine",
  "multi-domain-engine",
  "self-review-engine",
  "professional-reasoning-certification",
  "task-manager",
  "product-engine",
  "search-engine",
  "export-engine",
  "recovery-engine",
  "health-monitor",
] as const;

export type FutureModuleId = (typeof FUTURE_MODULE_IDS)[number];

export class AiModuleRegistry {
  private readonly entries = new Map<string, ModuleRegistryEntry>();

  initializeSlots(definitions: FutureModuleDefinition[], logger: AiCoreLogger): void {
    this.entries.clear();

    for (const def of definitions) {
      this.entries.set(def.id, {
        id: def.id,
        name: def.name,
        status: "slot-reserved",
        enabled: def.enabled,
      });
      logger.info("module-registration", `Reserved module slot: ${def.id}`, {
        moduleId: def.id,
        moduleName: def.name,
      });
    }
  }

  registerPlugin(plugin: AiModulePlugin, logger: AiCoreLogger): void {
    const existing = this.entries.get(plugin.id);
    if (!existing) {
      throw new Error(`Cannot register unknown module: ${plugin.id}`);
    }

    this.entries.set(plugin.id, {
      ...existing,
      name: plugin.name,
      status: "registered",
      registeredAt: new Date().toISOString(),
      plugin,
    });

    logger.info("module-registration", `Module registered: ${plugin.id}`, {
      moduleId: plugin.id,
      version: plugin.version,
    });
  }

  async initializeModule(id: string, logger: AiCoreLogger): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry?.plugin) {
      throw new Error(`Module not registered: ${id}`);
    }

    try {
      await entry.plugin.initialize();
      this.updateStatus(id, "initialized");
      logger.info("module-registration", `Module initialized: ${id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.updateStatus(id, "failed", message);
      logger.error("module-registration", `Module initialization failed: ${id}`, {
        error: message,
      });
      throw error;
    }
  }

  async shutdownModule(id: string, logger: AiCoreLogger): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry?.plugin) {
      return;
    }
    await entry.plugin.shutdown();
    this.updateStatus(id, "registered");
    logger.info("module-registration", `Module shut down: ${id}`);
  }

  getEntry(id: string): ModuleRegistryEntry | undefined {
    return this.entries.get(id);
  }

  getPlugin(id: string): AiModulePlugin | undefined {
    return this.entries.get(id)?.plugin;
  }

  getAllEntries(): ModuleRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  getRegisteredCount(): number {
    return this.getAllEntries().filter((e) => e.status !== "slot-reserved").length;
  }

  getSlotCount(): number {
    return this.entries.size;
  }

  private updateStatus(
    id: string,
    status: ModuleRegistrationStatus,
    lastError?: string
  ): void {
    const entry = this.entries.get(id);
    if (!entry) {
      return;
    }
    this.entries.set(id, {
      ...entry,
      status,
      initializedAt:
        status === "initialized" ? new Date().toISOString() : entry.initializedAt,
      lastError,
    });
  }
}
