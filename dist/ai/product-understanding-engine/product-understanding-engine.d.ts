import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductUnderstandingLogger } from "./product-understanding-logger.js";
import { ProductUnderstandingRecordStore } from "./product-understanding-stores.js";
import { ProductUnderstandingEngineStatusReport, ProductUnderstandingInput, ProductUnderstandingRecord, ProductUnderstandingResult, ProductUnderstandingSearchQuery } from "./types.js";
/**
 * Product Understanding Engine — transforms analyzed product information into deep product understanding.
 */
export declare class AiProductUnderstandingEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ProductUnderstandingLogger;
    readonly records: ProductUnderstandingRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private understandingTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    understandProduct(input: ProductUnderstandingInput): Promise<ProductUnderstandingResult>;
    getUnderstanding(productId: string): ProductUnderstandingRecord | null;
    searchUnderstanding(query: ProductUnderstandingSearchQuery): ProductUnderstandingRecord[];
    detectRelationships(productId: string): ProductUnderstandingRecord["relationships"] | null;
    repairUnderstanding(productId: string): Promise<ProductUnderstandingResult | null>;
    buildStatusReport(): ProductUnderstandingEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=product-understanding-engine.d.ts.map