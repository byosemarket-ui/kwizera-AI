import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { EnhancementPlanningAnalyzer } from "./enhancement-planning-analyzer.js";
import { EnhancementPlanningLinker } from "./enhancement-planning-linker.js";
import { EnhancementPlanningLogger } from "./enhancement-planning-logger.js";
import { EnhancementPlanningScorer } from "./enhancement-planning-scorer.js";
import { ImageEnhancementPlanningRecordStore } from "./enhancement-planning-stores.js";
import { ImageEnhancementPlanningInput, ImageEnhancementPlanningRecord, ImageEnhancementPlanningResult, ImageEnhancementPlanningSearchQuery } from "./types.js";
export declare class EnhancementPlanningProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: EnhancementPlanningAnalyzer, scorer: EnhancementPlanningScorer, linker: EnhancementPlanningLinker, records: ImageEnhancementPlanningRecordStore, logger: EnhancementPlanningLogger);
    plan(input: ImageEnhancementPlanningInput): Promise<ImageEnhancementPlanningResult>;
    search(query: ImageEnhancementPlanningSearchQuery): ImageEnhancementPlanningRecord[];
}
//# sourceMappingURL=enhancement-planning-processor.d.ts.map