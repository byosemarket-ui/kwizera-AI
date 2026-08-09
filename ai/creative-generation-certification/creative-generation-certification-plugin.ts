import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { CreativeGenerationCertificationManager } from "./creative-generation-certification-manager.js";

export function createCreativeGenerationCertificationPlugin(
  manager: CreativeGenerationCertificationManager,
  _core: AiCoreManager,
): AiModulePlugin {
  return {
    id: "creative-generation-certification",
    name: "KWIZERA AI Creative Generation Certification",
    version: "1.0.0",
    async initialize() {
      if (!manager.isInitialized()) throw new Error("Creative Generation Certification Manager is not initialized");
    },
    async shutdown() { /* certification JSON remains durable */ },
    async healthCheck() {
      const awareness = manager.getAiMeCreativeGenerationCertificationAwareness();
      return {
        healthy: manager.isInitialized() && awareness.available,
        message: awareness.summary,
      };
    },
  };
}
