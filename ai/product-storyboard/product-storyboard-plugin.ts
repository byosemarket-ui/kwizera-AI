import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductStoryboardManager } from "./product-storyboard-manager.js";

export function createProductStoryboardPlugin(
  manager: ProductStoryboardManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "product-storyboard-runtime",
    name: "KWIZERA AI Product Storyboard Runtime",
    version: "0.1.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Storyboard Manager is not initialized");
    },
    async shutdown() { /* storyboards remain durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductStoryboardAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
