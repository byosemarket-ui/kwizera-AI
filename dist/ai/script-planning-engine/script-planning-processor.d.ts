import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ScriptPlanningAnalyzer } from "./script-planning-analyzer.js";
import { ScriptPlanningLinker } from "./script-planning-linker.js";
import { ScriptPlanningLogger } from "./script-planning-logger.js";
import { ScriptPlanningScorer } from "./script-planning-scorer.js";
import { ScriptPlanningRecordStore } from "./script-planning-stores.js";
import { ScriptPlanningInput, ScriptPlanningRecord, ScriptPlanningResult, ScriptPlanningSearchQuery } from "./types.js";
export declare class ScriptPlanningProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: ScriptPlanningAnalyzer, scorer: ScriptPlanningScorer, linker: ScriptPlanningLinker, records: ScriptPlanningRecordStore, logger: ScriptPlanningLogger);
    createScriptPlan(input: ScriptPlanningInput): Promise<ScriptPlanningResult>;
    search(query: ScriptPlanningSearchQuery): ScriptPlanningRecord[];
    private applySceneRepairs;
    private applyScoreRepairs;
    private reject;
}
//# sourceMappingURL=script-planning-processor.d.ts.map