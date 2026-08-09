import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductIntelligenceManager } from "./product-intelligence-manager.js";
export function createProductIntelligencePlugin(manager: ProductIntelligenceManager, _core: AiCoreManager): AiModulePlugin {
  return {
    id: "product-intelligence-runtime",
    name: "KWIZERA AI Product Intelligence Runtime",
    version: "0.2.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Intelligence Manager is not initialized");
    },
    async shutdown() { /* profiles remain durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductIntelligenceAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}