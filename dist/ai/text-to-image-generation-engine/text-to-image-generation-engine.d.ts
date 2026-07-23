import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { TextToImageGenerationLogger } from "./text-to-image-generation-logger.js";
import { TextToImageGenerationRecordStore } from "./text-to-image-generation-stores.js";
import { TextToImageGenerationEngineStatusReport, TextToImageGenerationInput, TextToImageGenerationRecord, TextToImageGenerationResult, TextToImagePlatform, TextToImageSearchQuery } from "./types.js";
/**
 * AI Text-to-Image Generation Engine — transforms structured prompts into
 * production-ready image generation blueprints.
 */
export declare class AiTextToImageGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: TextToImageGenerationLogger;
    readonly records: TextToImageGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateImagePlan(input: TextToImageGenerationInput): Promise<TextToImageGenerationResult>;
    getImagePlan(imagePlanId: string): TextToImageGenerationRecord | null;
    getImagePlansByProduct(productId: string): TextToImageGenerationRecord[];
    getImagePlansByProject(projectId: string): TextToImageGenerationRecord[];
    searchImagePlans(query: TextToImageSearchQuery): TextToImageGenerationRecord[];
    repairImagePlan(productId: string, platform?: TextToImagePlatform): Promise<TextToImageGenerationResult | null>;
    buildStatusReport(): TextToImageGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=text-to-image-generation-engine.d.ts.map