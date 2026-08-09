import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiProfessionalReasoningCertificationEngine } from "./professional-reasoning-certification-engine.js";

export function createProfessionalReasoningCertificationPlugin(
  engine: AiProfessionalReasoningCertificationEngine,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "professional-reasoning-certification",
    name: "KWIZERA AI Professional Reasoning & Decision Certification",
    version: "1.0.0",

    async initialize(): Promise<void> {
      engine.initialize(core);
    },

    async shutdown(): Promise<void> {
      // lightweight — certificate JSON only
    },

    async healthCheck() {
      return {
        healthy: engine.isInitialized(),
        message: engine.isInitialized()
          ? "Professional Reasoning Certification operational"
          : "Professional Reasoning Certification not initialized",
      };
    },
  };
}
