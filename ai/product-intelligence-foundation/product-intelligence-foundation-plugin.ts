import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiProductIntelligenceFoundation } from "./product-intelligence-foundation.js";

export function createProductIntelligenceFoundationPlugin(
  foundation: AiProductIntelligenceFoundation,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "product-engine",
    name: "KWIZERA AI Product Intelligence Foundation",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!foundation.isInitialized()) {
        throw new Error("Product Intelligence Foundation must be initialized before plugin registration");
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
          ? `Product Intelligence Foundation operational (${report.preparedModules} modules prepared)`
          : "Product Intelligence Foundation not ready",
      };
    },
  };
}
