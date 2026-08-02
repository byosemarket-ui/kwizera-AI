import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { GenerationOptimizationManager } from "./generation-optimization-manager.js";

export function createGenerationOptimizationPlugin(manager: GenerationOptimizationManager, _core: AiCoreManager): AiModulePlugin { return { id: "generation-optimization-runtime", name: "KWIZERA AI Generation Optimization Runtime", version: "0.1.0", async initialize() { if (!manager.isInitialized()) throw new Error("Generation Optimization Manager is not initialized"); }, async shutdown() { /* persisted queue and reports remain available */ }, async healthCheck() { return { healthy: manager.isInitialized(), message: "Generation optimization runtime operational" }; } }; }