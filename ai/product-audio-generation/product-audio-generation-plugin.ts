import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductAudioGenerationManager } from "./product-audio-generation-manager.js";

export function createProductAudioGenerationPlugin(
  manager: ProductAudioGenerationManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "product-audio-generation-runtime",
    name: "KWIZERA AI Product Audio Generation Runtime",
    version: "0.1.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Audio Generation Manager is not initialized");
    },
    async shutdown() { /* generations remain durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductAudioGenerationAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
