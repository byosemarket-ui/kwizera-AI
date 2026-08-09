import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiSelfReviewEngine } from "./self-review-engine.js";

export function createSelfReviewEnginePlugin(
  engine: AiSelfReviewEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "self-review-engine",
    name: "KWIZERA AI Self-Review & Professional Evaluation Engine",
    version: "0.1.0",

    async initialize(): Promise<void> {
      engine.initialize(core);
    },

    async shutdown(): Promise<void> {
      // lightweight — offline JSONL memory only
    },

    async healthCheck() {
      return {
        healthy: engine.isInitialized(),
        message: engine.isInitialized()
          ? "Self-Review Engine operational"
          : "Self-Review Engine not initialized",
      };
    },
  };
}
