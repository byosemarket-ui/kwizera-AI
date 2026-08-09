import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductScenePlanningManager } from "./product-scene-planning-manager.js";

export function createProductScenePlanningPlugin(
  manager: ProductScenePlanningManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "product-scene-planning-runtime",
    name: "KWIZERA AI Product Scene Planning Runtime",
    version: "0.1.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Scene Planning Manager is not initialized");
    },
    async shutdown() { /* plans remain durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductScenePlanningAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
