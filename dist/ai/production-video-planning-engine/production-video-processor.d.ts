import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { ProductionVideoAnalyzer } from "./production-video-analyzer.js";
import { ProductionVideoLinker } from "./production-video-linker.js";
import { ProductionVideoLogger } from "./production-video-logger.js";
import { ProductionVideoScorer } from "./production-video-scorer.js";
import { ProductionVideoPlanningRecordStore } from "./production-video-stores.js";
import { ProductionVideoPlanningInput, ProductionVideoPlanningRecord, ProductionVideoPlanningResult, ProductionVideoPlanningSearchQuery } from "./types.js";
export declare class ProductionVideoProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: ProductionVideoAnalyzer, scorer: ProductionVideoScorer, linker: ProductionVideoLinker, records: ProductionVideoPlanningRecordStore, logger: ProductionVideoLogger);
    planProduction(input: ProductionVideoPlanningInput): Promise<ProductionVideoPlanningResult>;
    search(query: ProductionVideoPlanningSearchQuery): ProductionVideoPlanningRecord[];
    private fail;
}
//# sourceMappingURL=production-video-processor.d.ts.map