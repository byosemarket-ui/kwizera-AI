import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageUnderstandingLogger } from "./image-understanding-logger.js";
import { ImageUnderstandingRecordStore } from "./image-understanding-stores.js";
import { ImageUnderstandingEngineStatusReport, ImageUnderstandingInput, ImageUnderstandingRecord, ImageUnderstandingResult, ImageUnderstandingSearchQuery } from "./types.js";
/**
 * Image Understanding Engine — transforms image analysis into deep visual understanding.
 */
export declare class AiImageUnderstandingEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageUnderstandingLogger;
    readonly records: ImageUnderstandingRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private understandingTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    understandImage(input: ImageUnderstandingInput): Promise<ImageUnderstandingResult>;
    getUnderstanding(imageId: string): ImageUnderstandingRecord | null;
    searchUnderstanding(query: ImageUnderstandingSearchQuery): ImageUnderstandingRecord[];
    detectRelationships(imageId: string): ImageUnderstandingRecord["relationships"] | null;
    repairUnderstanding(imageId: string): Promise<ImageUnderstandingResult | null>;
    buildStatusReport(): ImageUnderstandingEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-understanding-engine.d.ts.map