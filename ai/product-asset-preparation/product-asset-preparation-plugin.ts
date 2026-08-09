import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductAssetPreparationManager } from "./product-asset-preparation-manager.js";

export function createProductAssetPreparationPlugin(
  manager: ProductAssetPreparationManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "product-asset-preparation-runtime",
    name: "KWIZERA AI Product Asset Preparation Runtime",
    version: "0.1.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Asset Preparation Manager is not initialized");
    },
    async shutdown() { /* library remains durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductAssetAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
