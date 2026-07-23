import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiKnowledgeFoundation } from "./knowledge-foundation.js";

export function createKnowledgeFoundationPlugin(
  foundation: AiKnowledgeFoundation,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "knowledge-engine",
    name: "KWIZERA AI Knowledge Foundation",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!foundation.isInitialized()) {
        throw new Error("Knowledge Foundation must be initialized before plugin registration");
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
          ? `Knowledge Foundation operational (${report.preparedCategories} categories prepared)`
          : "Knowledge Foundation not ready",
      };
    },
  };
}
