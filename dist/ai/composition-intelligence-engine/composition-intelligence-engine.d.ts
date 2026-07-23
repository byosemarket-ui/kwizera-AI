import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { CompositionLogger } from "./composition-logger.js";
import { CompositionIntelligenceRecordStore } from "./composition-stores.js";
import { CompositionIntelligenceEngineStatusReport, CompositionIntelligenceInput, CompositionIntelligenceRecord, CompositionIntelligenceResult, CompositionIntelligenceSearchQuery } from "./types.js";
/**
 * Composition Intelligence Engine — analyzes, understands and plans image composition for creative production.
 */
export declare class AiCompositionIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: CompositionLogger;
    readonly records: CompositionIntelligenceRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeComposition(input: CompositionIntelligenceInput): Promise<CompositionIntelligenceResult>;
    getComposition(imageId: string): CompositionIntelligenceRecord | null;
    searchCompositions(query: CompositionIntelligenceSearchQuery): CompositionIntelligenceRecord[];
    detectRelationships(imageId: string): CompositionIntelligenceRecord["relationships"] | null;
    repairComposition(imageId: string): Promise<CompositionIntelligenceResult | null>;
    buildStatusReport(): CompositionIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=composition-intelligence-engine.d.ts.map