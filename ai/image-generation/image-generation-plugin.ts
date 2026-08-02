import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ImageGenerationManager } from "./image-generation-manager.js";

export function createImageGenerationPlugin(manager: ImageGenerationManager, _core: AiCoreManager): AiModulePlugin { return { id: "image-generation-runtime", name: "KWIZERA AI Image Generation Runtime", version: "0.1.0", async initialize() { if (!manager.isInitialized()) throw new Error("Image Generation Manager is not initialized"); }, async shutdown() { /* persisted artifacts remain available */ }, async healthCheck() { return { healthy: manager.isInitialized(), message: "Image generation runtime operational" }; } }; }