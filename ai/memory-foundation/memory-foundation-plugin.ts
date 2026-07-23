import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiMemoryFoundation } from "./memory-foundation.js";

export function createMemoryFoundationPlugin(
  foundation: AiMemoryFoundation,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "memory-engine",
    name: "KWIZERA AI Persistent Memory Foundation",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!foundation.isInitialized()) {
        throw new Error("Memory Foundation must be initialized before plugin registration");
      }
    },

    async shutdown(): Promise<void> {
      await foundation.shutdown();
    },

    async healthCheck() {
      const report = foundation.buildStatusReport();
      return {
        healthy: foundation.isStartupComplete() && report.readinessScore >= 80,
        message: foundation.isStartupComplete()
          ? `Memory Foundation operational (${report.preparedCategories} categories prepared)`
          : "Memory Foundation not ready",
      };
    },
  };
}
