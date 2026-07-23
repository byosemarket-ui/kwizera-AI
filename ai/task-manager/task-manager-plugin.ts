import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiTaskManager } from "./task-manager.js";

export function createTaskManagerPlugin(
  manager: AiTaskManager,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "task-manager",
    name: "KWIZERA AI Task Manager",
    version: "0.1.0",

    async initialize(): Promise<void> {
      manager.initialize(core);
    },

    async shutdown(): Promise<void> {
      // lightweight — no resources to release in Step 2F
    },

    async healthCheck() {
      return {
        healthy: manager.isInitialized(),
        message: manager.isInitialized()
          ? "Task Manager operational"
          : "Task Manager not initialized",
      };
    },
  };
}
