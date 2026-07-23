import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceOptimizationAnalyzer } from "./product-intelligence-optimization-analyzer.js";
import { ProductIntelligenceOptimizationLinker } from "./product-intelligence-optimization-linker.js";
import { ProductIntelligenceOptimizationLogger } from "./product-intelligence-optimization-logger.js";
import { ProductIntelligenceOptimizationScorer } from "./product-intelligence-optimization-scorer.js";
import { ProductIntelligenceOptimizationRecordStore } from "./product-intelligence-optimization-stores.js";
import { ProductIntelligenceOptimizationInput, ProductIntelligenceOptimizationRecord, ProductIntelligenceOptimizationResult, ProductIntelligenceOptimizationSearchQuery } from "./types.js";
export declare class ProductIntelligenceOptimizationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: ProductIntelligenceOptimizationAnalyzer, scorer: ProductIntelligenceOptimizationScorer, linker: ProductIntelligenceOptimizationLinker, records: ProductIntelligenceOptimizationRecordStore, logger: ProductIntelligenceOptimizationLogger);
    runOptimization(input: ProductIntelligenceOptimizationInput): Promise<ProductIntelligenceOptimizationResult>;
    search(query: ProductIntelligenceOptimizationSearchQuery): ProductIntelligenceOptimizationRecord[];
    restoreRecoveryPoint(recoveryId: string): boolean;
    private reject;
}
//# sourceMappingURL=product-intelligence-optimization-processor.d.ts.map