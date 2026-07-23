import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductAnalysisAnalyzer } from "./product-analysis-analyzer.js";
import { ProductAnalysisCompletenessDetector } from "./product-analysis-completeness.js";
import { ProductAnalysisLinker } from "./product-analysis-linker.js";
import { ProductAnalysisLogger } from "./product-analysis-logger.js";
import { ProductAnalysisScorer } from "./product-analysis-scorer.js";
import { ProductAnalysisRecordStore } from "./product-analysis-stores.js";
import { ProductAnalysisEngineInput, ProductAnalysisEngineResult, ProductAnalysisIntelligenceRecord, ProductAnalysisSearchQuery } from "./types.js";
export declare class ProductAnalysisProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly completeness;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: ProductAnalysisAnalyzer, completeness: ProductAnalysisCompletenessDetector, scorer: ProductAnalysisScorer, linker: ProductAnalysisLinker, records: ProductAnalysisRecordStore, logger: ProductAnalysisLogger);
    analyze(input: ProductAnalysisEngineInput): Promise<ProductAnalysisEngineResult>;
    search(query: ProductAnalysisSearchQuery): ProductAnalysisIntelligenceRecord[];
}
//# sourceMappingURL=product-analysis-processor.d.ts.map