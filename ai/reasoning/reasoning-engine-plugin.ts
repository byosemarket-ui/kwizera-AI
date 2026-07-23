import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiReasoningEngine } from "./reasoning-engine.js";

export function createReasoningEnginePlugin(
  engine: AiReasoningEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "reasoning-engine",
    name: "KWIZERA AI Reasoning Engine",
    version: "0.1.0",

    async initialize(): Promise<void> {
      engine.initialize(core);
    },

    async shutdown(): Promise<void> {
      // lightweight — no resources to release in Step 2C
    },

    async healthCheck() {
      return {
        healthy: engine.isInitialized(),
        message: engine.isInitialized()
          ? "Reasoning Engine operational"
          : "Reasoning Engine not initialized",
      };
    },
  };
}
