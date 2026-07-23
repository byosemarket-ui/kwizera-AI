import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiVideoGenerationFoundation } from "./video-generation-foundation.js";

export function createVideoGenerationFoundationPlugin(
  foundation: AiVideoGenerationFoundation,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "video-generation-engine",
    name: "KWIZERA AI Video Generation Foundation",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!foundation.isInitialized()) {
        throw new Error("AI Video Generation Foundation must be initialized before plugin registration");
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
          ? `AI Video Generation Foundation operational (${report.preparedModules} modules prepared)`
          : "AI Video Generation Foundation not ready",
      };
    },
  };
}
