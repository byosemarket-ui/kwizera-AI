import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { CreativeImageLogger } from "./creative-image-logger.js";
import { CreativeImageIntelligenceRecordStore } from "./creative-image-stores.js";
import { CreativeImageIntelligenceEngineStatusReport, CreativeImageIntelligenceInput, CreativeImageIntelligenceRecord, CreativeImageIntelligenceResult, CreativeImageIntelligenceSearchQuery } from "./types.js";
/**

 * Creative Image Intelligence Engine — prepares creative layout and production planning before image generation.

 */
export declare class AiCreativeImageIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: CreativeImageLogger;
    readonly records: CreativeImageIntelligenceRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    planCreativeImage(input: CreativeImageIntelligenceInput): Promise<CreativeImageIntelligenceResult>;
    getCreativePlan(imageId: string): CreativeImageIntelligenceRecord | null;
    searchCreativePlans(query: CreativeImageIntelligenceSearchQuery): CreativeImageIntelligenceRecord[];
    detectRelationships(imageId: string): CreativeImageIntelligenceRecord["relationships"] | null;
    repairCreativePlan(imageId: string): Promise<CreativeImageIntelligenceResult | null>;
    buildStatusReport(): CreativeImageIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=creative-image-intelligence-engine.d.ts.map