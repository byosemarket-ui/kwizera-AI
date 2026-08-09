import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ProductPromptOrchestrationManager } from "./product-prompt-orchestration-manager.js";

export function createProductPromptOrchestrationPlugin(
  manager: ProductPromptOrchestrationManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "product-prompt-orchestration-runtime",
    name: "KWIZERA AI Product Prompt Orchestration Runtime",
    version: "0.1.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Product Prompt Orchestration Manager is not initialized");
    },
    async shutdown() { /* orchestrations remain durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeProductPromptOrchestrationAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
