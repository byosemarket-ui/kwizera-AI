import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductionPlanningAnalyzer } from "./production-planning-analyzer.js";
import { ProductionPlanningLinker } from "./production-planning-linker.js";
import { ProductionPlanningLogger } from "./production-planning-logger.js";
import { ProductionPlanningScorer } from "./production-planning-scorer.js";
import { ProductionPlanningRecordStore } from "./production-planning-stores.js";
import { ProductionPlanningInput, ProductionPlanningRecord, ProductionPlanningResult, ProductionPlanningSearchQuery } from "./types.js";
export declare class ProductionPlanningProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: ProductionPlanningAnalyzer, scorer: ProductionPlanningScorer, linker: ProductionPlanningLinker, records: ProductionPlanningRecordStore, logger: ProductionPlanningLogger);
    createProductionPlan(input: ProductionPlanningInput): Promise<ProductionPlanningResult>;
    search(query: ProductionPlanningSearchQuery): ProductionPlanningRecord[];
    private applyRepairs;
    private reject;
}
//# sourceMappingURL=production-planning-processor.d.ts.map