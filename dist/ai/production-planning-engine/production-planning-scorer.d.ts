import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import { AssetManagement, DependencyValidation, ProductionPlanningScores, ProductionWorkflow, SceneProductionPlan } from "./types.js";
export declare class ProductionPlanningScorer {
    private readonly analyzer;
    computeScores(sceneProductionPlans: SceneProductionPlan[], workflow: ProductionWorkflow, assets: AssetManagement, dependencies: DependencyValidation, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord): ProductionPlanningScores;
    isProductionPlanValid(scores: ProductionPlanningScores, dependencies: DependencyValidation, assets: AssetManagement, sceneProductionPlans: SceneProductionPlan[], storyboard: StoryboardIntelligenceRecord, alignmentIssues: string[]): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(sceneProductionPlans: SceneProductionPlan[], storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, dependencies: DependencyValidation, scores: ProductionPlanningScores): boolean;
    private computeDependencyScore;
    private computeAssetScore;
    private computeWorkflowScore;
    private computeProductionScore;
}
//# sourceMappingURL=production-planning-scorer.d.ts.map