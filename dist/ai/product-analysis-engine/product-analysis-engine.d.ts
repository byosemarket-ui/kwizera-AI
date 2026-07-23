import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductAnalysisLogger } from "./product-analysis-logger.js";
import { ProductAnalysisRecordStore } from "./product-analysis-stores.js";
import { ProductAnalysisEngineInput, ProductAnalysisEngineResult, ProductAnalysisEngineStatusReport, ProductAnalysisIntelligenceRecord, ProductAnalysisSearchQuery } from "./types.js";
/**
 * Product Analysis Engine — collects, organizes, validates and analyzes product information
 * before creative planning begins.
 */
export declare class AiProductAnalysisEngine {
    private foundation;
    private storageRoot;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ProductAnalysisLogger;
    readonly records: ProductAnalysisRecordStore;
    private readonly analyzer;
    private readonly completeness;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private classificationTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeProduct(input: ProductAnalysisEngineInput): Promise<ProductAnalysisEngineResult>;
    getProduct(productId: string): ProductAnalysisIntelligenceRecord | null;
    searchProducts(query: ProductAnalysisSearchQuery): ProductAnalysisIntelligenceRecord[];
    detectRelationships(productId: string): ProductAnalysisIntelligenceRecord["relationships"] | null;
    repairProduct(productId: string): Promise<ProductAnalysisEngineResult | null>;
    buildStatusReport(): ProductAnalysisEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getEngineDir(): string;
    private ensureReady;
}
//# sourceMappingURL=product-analysis-engine.d.ts.map