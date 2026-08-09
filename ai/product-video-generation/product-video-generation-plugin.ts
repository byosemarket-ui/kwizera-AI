import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductVideoGenerationManager } from "./product-video-generation-manager.js";

export function createProductVideoGenerationPlugin(
  manager: ProductVideoGenerationManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "product-video-generation-runtime",
    name: "KWIZERA AI Product Video Generation Runtime",
    version: "0.1.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Video Generation Manager is not initialized");
    },
    async shutdown() { /* generations remain durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductVideoGenerationAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
