import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiImageIntelligenceFoundation } from "./image-intelligence-foundation.js";

export function createImageIntelligenceFoundationPlugin(
  foundation: AiImageIntelligenceFoundation,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "image-engine",
    name: "KWIZERA AI Image Intelligence Foundation",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!foundation.isInitialized()) {
        throw new Error("Image Intelligence Foundation must be initialized before plugin registration");
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
          ? `Image Intelligence Foundation operational (${report.preparedModules} modules prepared)`
          : "Image Intelligence Foundation not ready",
      };
    },
  };
}
