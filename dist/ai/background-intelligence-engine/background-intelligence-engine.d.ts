import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { BackgroundLogger } from "./background-logger.js";
import { BackgroundIntelligenceRecordStore } from "./background-stores.js";
import { BackgroundIntelligenceEngineStatusReport, BackgroundIntelligenceInput, BackgroundIntelligenceRecord, BackgroundIntelligenceResult, BackgroundIntelligenceSearchQuery } from "./types.js";
/**
 * Background Intelligence Engine — understands, analyzes and plans background usage for creative production.
 */
export declare class AiBackgroundIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: BackgroundLogger;
    readonly records: BackgroundIntelligenceRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeBackground(input: BackgroundIntelligenceInput): Promise<BackgroundIntelligenceResult>;
    getBackground(imageId: string): BackgroundIntelligenceRecord | null;
    searchBackgrounds(query: BackgroundIntelligenceSearchQuery): BackgroundIntelligenceRecord[];
    detectRelationships(imageId: string): BackgroundIntelligenceRecord["relationships"] | null;
    repairBackground(imageId: string): Promise<BackgroundIntelligenceResult | null>;
    buildStatusReport(): BackgroundIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=background-intelligence-engine.d.ts.map