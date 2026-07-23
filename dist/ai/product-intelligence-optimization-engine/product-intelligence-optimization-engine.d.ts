import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { ProductIntelligenceOptimizationLogger } from "./product-intelligence-optimization-logger.js";
import { ProductIntelligenceOptimizationRecordStore } from "./product-intelligence-optimization-stores.js";
import { ProductIntelligenceOptimizationEngineStatusReport, ProductIntelligenceOptimizationInput, ProductIntelligenceOptimizationRecord, ProductIntelligenceOptimizationResult, ProductIntelligenceOptimizationSearchQuery } from "./types.js";
/**
 * Product Intelligence Optimization Engine — continuously improves quality,
 * speed, consistency and efficiency across all Product Intelligence modules.
 */
export declare class AiProductIntelligenceOptimizationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ProductIntelligenceOptimizationLogger;
    readonly records: ProductIntelligenceOptimizationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private optimizationTimes;
    private searchTimes;
    private recoveryTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    runOptimization(input: ProductIntelligenceOptimizationInput): Promise<ProductIntelligenceOptimizationResult>;
    getOptimization(optimizationId: string): ProductIntelligenceOptimizationRecord | null;
    getOptimizationsByProduct(productId: string): ProductIntelligenceOptimizationRecord[];
    searchOptimizations(query: ProductIntelligenceOptimizationSearchQuery): ProductIntelligenceOptimizationRecord[];
    restoreRecoveryPoint(recoveryId: string): boolean;
    repairOptimization(productId: string, platform?: CreativePlatform): Promise<ProductIntelligenceOptimizationResult | null>;
    getCache(): import("./types.js").CacheOptimization;
    buildStatusReport(): ProductIntelligenceOptimizationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=product-intelligence-optimization-engine.d.ts.map