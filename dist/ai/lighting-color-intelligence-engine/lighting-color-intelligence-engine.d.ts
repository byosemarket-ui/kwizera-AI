import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { LightingColorLogger } from "./lighting-color-logger.js";
import { LightingColorIntelligenceRecordStore } from "./lighting-color-stores.js";
import { LightingColorIntelligenceEngineStatusReport, LightingColorIntelligenceInput, LightingColorIntelligenceRecord, LightingColorIntelligenceResult, LightingColorIntelligenceSearchQuery } from "./types.js";
/**
 * Lighting & Color Intelligence Engine — analyzes lighting and color for creative production planning.
 */
export declare class AiLightingColorIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: LightingColorLogger;
    readonly records: LightingColorIntelligenceRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeLightingColor(input: LightingColorIntelligenceInput): Promise<LightingColorIntelligenceResult>;
    getLightingColor(imageId: string): LightingColorIntelligenceRecord | null;
    searchLightingColor(query: LightingColorIntelligenceSearchQuery): LightingColorIntelligenceRecord[];
    detectRelationships(imageId: string): LightingColorIntelligenceRecord["relationships"] | null;
    repairLightingColor(imageId: string): Promise<LightingColorIntelligenceResult | null>;
    buildStatusReport(): LightingColorIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=lighting-color-intelligence-engine.d.ts.map