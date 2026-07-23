import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiImageGenerationFoundation } from "./image-generation-foundation.js";

export function createImageGenerationFoundationPlugin(
  foundation: AiImageGenerationFoundation,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "image-generation-engine",
    name: "KWIZERA AI Image Generation Foundation",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!foundation.isInitialized()) {
        throw new Error("AI Image Generation Foundation must be initialized before plugin registration");
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
          ? `AI Image Generation Foundation operational (${report.preparedModules} modules prepared)`
          : "AI Image Generation Foundation not ready",
      };
    },
  };
}
