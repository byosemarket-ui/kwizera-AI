import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiRecoveryEngine } from "./recovery-engine.js";

export function createRecoveryEnginePlugin(
  engine: AiRecoveryEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "recovery-engine",
    name: "KWIZERA AI Recovery Engine",
    version: "0.1.0",

    async initialize(): Promise<void> {
      // wired during AiCoreManager.start before plugin registration
      void core;
      if (!engine.isInitialized()) {
        throw new Error("Recovery Engine must be initialized before plugin registration");
      }
    },

    async shutdown(): Promise<void> {
      // lightweight — state persisted by State Manager
    },

    async healthCheck() {
      const report = engine.buildStatusReport();
      return {
        healthy: engine.isInitialized() && report.readinessScore >= 80,
        message: engine.isInitialized()
          ? `Recovery Engine operational (${report.recoverySuccessRate}% success rate)`
          : "Recovery Engine not initialized",
      };
    },
  };
}
