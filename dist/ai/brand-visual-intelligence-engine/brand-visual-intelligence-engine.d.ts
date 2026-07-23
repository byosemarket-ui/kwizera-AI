import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { BrandVisualLogger } from "./brand-visual-logger.js";
import { BrandVisualIntelligenceRecordStore } from "./brand-visual-stores.js";
import { BrandVisualIntelligenceEngineStatusReport, BrandVisualIntelligenceInput, BrandVisualIntelligenceRecord, BrandVisualIntelligenceResult, BrandVisualIntelligenceSearchQuery } from "./types.js";
/**
 * Brand Visual Intelligence Engine — understands, validates and protects brand visual identity.
 */
export declare class AiBrandVisualIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: BrandVisualLogger;
    readonly records: BrandVisualIntelligenceRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeBrandVisual(input: BrandVisualIntelligenceInput): Promise<BrandVisualIntelligenceResult>;
    getBrandVisual(imageId: string): BrandVisualIntelligenceRecord | null;
    getBrandRecords(brandName: string): BrandVisualIntelligenceRecord[];
    searchBrandVisual(query: BrandVisualIntelligenceSearchQuery): BrandVisualIntelligenceRecord[];
    detectRelationships(imageId: string): BrandVisualIntelligenceRecord["relationships"] | null;
    repairBrandVisual(imageId: string): Promise<BrandVisualIntelligenceResult | null>;
    buildStatusReport(): BrandVisualIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=brand-visual-intelligence-engine.d.ts.map