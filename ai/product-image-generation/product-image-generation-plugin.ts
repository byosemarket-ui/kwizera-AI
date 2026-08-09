import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductImageGenerationManager } from "./product-image-generation-manager.js";

export function createProductImageGenerationPlugin(
  manager: ProductImageGenerationManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "product-image-generation-runtime",
    name: "KWIZERA AI Product Image Generation Runtime",
    version: "0.1.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Image Generation Manager is not initialized");
    },
    async shutdown() { /* generations remain durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductImageGenerationAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
