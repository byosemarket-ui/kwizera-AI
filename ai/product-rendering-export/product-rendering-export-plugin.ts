import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductRenderingExportManager } from "./product-rendering-export-manager.js";

export function createProductRenderingExportPlugin(
  manager: ProductRenderingExportManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "product-rendering-export-runtime",
    name: "KWIZERA AI Product Rendering & Export Runtime",
    version: "0.1.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Rendering & Export Manager is not initialized");
    },
    async shutdown() { /* packages remain durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductRenderingExportAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
