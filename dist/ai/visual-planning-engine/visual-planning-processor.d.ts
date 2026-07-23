import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { VisualPlanningAnalyzer } from "./visual-planning-analyzer.js";
import { VisualPlanningLinker } from "./visual-planning-linker.js";
import { VisualPlanningLogger } from "./visual-planning-logger.js";
import { VisualPlanningScorer } from "./visual-planning-scorer.js";
import { VisualPlanningRecordStore } from "./visual-planning-stores.js";
import { VisualPlanningInput, VisualPlanningRecord, VisualPlanningResult, VisualPlanningSearchQuery } from "./types.js";
export declare class VisualPlanningProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: VisualPlanningAnalyzer, scorer: VisualPlanningScorer, linker: VisualPlanningLinker, records: VisualPlanningRecordStore, logger: VisualPlanningLogger);
    createVisualPlan(input: VisualPlanningInput): Promise<VisualPlanningResult>;
    search(query: VisualPlanningSearchQuery): VisualPlanningRecord[];
    private applySceneRepairs;
    private applyScoreRepairs;
    private reject;
}
//# sourceMappingURL=visual-planning-processor.d.ts.map