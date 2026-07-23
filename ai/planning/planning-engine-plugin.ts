import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiPlanningEngine } from "./planning-engine.js";

export function createPlanningEnginePlugin(
  engine: AiPlanningEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "planning-engine",
    name: "KWIZERA AI Planning Engine",
    version: "0.1.0",

    async initialize(): Promise<void> {
      engine.initialize(core);
    },

    async shutdown(): Promise<void> {
      // lightweight — no resources to release in Step 2D
    },

    async healthCheck() {
      return {
        healthy: engine.isInitialized(),
        message: engine.isInitialized()
          ? "Planning Engine operational"
          : "Planning Engine not initialized",
      };
    },
  };
}
