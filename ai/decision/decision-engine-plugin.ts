import type { AiModulePlugin, ModuleHealthResult } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiDecisionEngine } from "./decision-engine.js";

export function createDecisionEnginePlugin(
  engine: AiDecisionEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "decision-engine",
    name: "KWIZERA AI Decision Engine",
    version: "0.1.0",

    async initialize(): Promise<void> {
      engine.initialize(core);
    },

    async shutdown(): Promise<void> {
      // lightweight — no resources to release in Step 2B
    },

    async healthCheck(): Promise<ModuleHealthResult> {
      return {
        healthy: engine.isInitialized(),
        message: engine.isInitialized()
          ? "Decision Engine operational"
          : "Decision Engine not initialized",
      };
    },
  };
}
