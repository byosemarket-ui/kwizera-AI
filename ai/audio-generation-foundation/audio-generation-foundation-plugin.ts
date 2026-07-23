import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiAudioGenerationFoundation } from "./audio-generation-foundation.js";

export function createAudioGenerationFoundationPlugin(
  foundation: AiAudioGenerationFoundation,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "audio-generation-engine",
    name: "KWIZERA AI Audio Generation Foundation",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!foundation.isInitialized()) {
        throw new Error("AI Audio Generation Foundation must be initialized before plugin registration");
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
          ? `AI Audio Generation Foundation operational (${report.preparedModules} modules prepared)`
          : "AI Audio Generation Foundation not ready",
      };
    },
  };
}
