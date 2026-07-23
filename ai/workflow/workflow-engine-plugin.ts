import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiWorkflowEngine } from "./workflow-engine.js";

export function createWorkflowEnginePlugin(
  engine: AiWorkflowEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "workflow-engine",
    name: "KWIZERA AI Workflow Engine",
    version: "0.1.0",

    async initialize(): Promise<void> {
      engine.initialize(core);
    },

    async shutdown(): Promise<void> {
      // lightweight — no resources to release in Step 2E
    },

    async healthCheck() {
      return {
        healthy: engine.isInitialized(),
        message: engine.isInitialized()
          ? "Workflow Engine operational"
          : "Workflow Engine not initialized",
      };
    },
  };
}
