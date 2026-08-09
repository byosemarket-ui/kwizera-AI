import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiMultiDomainEngine } from "./multi-domain-engine.js";

export function createMultiDomainEnginePlugin(
  engine: AiMultiDomainEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "multi-domain-engine",
    name: "KWIZERA AI Multi-Domain Reasoning Engine",
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
          ? "Multi-Domain Reasoning Engine operational"
          : "Multi-Domain Reasoning Engine not initialized",
      };
    },
  };
}
