import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiRecommendationEngine } from "./recommendation-engine.js";

export function createRecommendationEnginePlugin(
  engine: AiRecommendationEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "recommendation-engine",
    name: "KWIZERA AI Recommendation Engine",
    version: "0.1.0",

    async initialize(): Promise<void> {
      engine.initialize(core);
    },

    async shutdown(): Promise<void> {
      // lightweight — offline JSONL memory only
    },

    async healthCheck() {
      return {
        healthy: engine.isInitialized(),
        message: engine.isInitialized()
          ? "Recommendation Engine operational"
          : "Recommendation Engine not initialized",
      };
    },
  };
}
