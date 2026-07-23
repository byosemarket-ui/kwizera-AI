import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ProductionPlanningAnalyzer } from "./production-planning-analyzer.js";
import { ProductionPlanningLinker } from "./production-planning-linker.js";
import { ProductionPlanningLogger } from "./production-planning-logger.js";
import { ProductionPlanningScorer } from "./production-planning-scorer.js";
import { ProductionImagePlanningRecordStore } from "./production-planning-stores.js";
import { ProductionImagePlanningInput, ProductionImagePlanningRecord, ProductionImagePlanningResult, ProductionImagePlanningSearchQuery } from "./types.js";
export declare class ProductionPlanningProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: ProductionPlanningAnalyzer, scorer: ProductionPlanningScorer, linker: ProductionPlanningLinker, records: ProductionImagePlanningRecordStore, logger: ProductionPlanningLogger);
    plan(input: ProductionImagePlanningInput): Promise<ProductionImagePlanningResult>;
    search(query: ProductionImagePlanningSearchQuery): ProductionImagePlanningRecord[];
    private fail;
}
//# sourceMappingURL=production-planning-processor.d.ts.map