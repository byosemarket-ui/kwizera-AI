import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiVideoIntelligenceFoundation } from "./video-intelligence-foundation.js";

export function createVideoIntelligenceFoundationPlugin(
  foundation: AiVideoIntelligenceFoundation,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "video-engine",
    name: "KWIZERA AI Video Intelligence Foundation",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!foundation.isInitialized()) {
        throw new Error("Video Intelligence Foundation must be initialized before plugin registration");
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
          ? `Video Intelligence Foundation operational (${report.preparedModules} modules prepared)`
          : "Video Intelligence Foundation not ready",
      };
    },
  };
}
