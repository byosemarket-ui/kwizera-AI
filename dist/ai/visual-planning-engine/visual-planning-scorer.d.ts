import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import { BackgroundPlanning, BrandConsistencyCheck, CameraPlanning, SceneVisualPlan, VisualPlanningScores } from "./types.js";
export declare class VisualPlanningScorer {
    computeScores(scenePlans: SceneVisualPlan[], background: BackgroundPlanning, camera: CameraPlanning, brandConsistency: BrandConsistencyCheck, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord): VisualPlanningScores;
    isVisualPlanValid(scores: VisualPlanningScores, scenePlans: SceneVisualPlan[], storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, brandConsistency: BrandConsistencyCheck, alignmentIssues: string[]): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scenePlans: SceneVisualPlan[], storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, scores: VisualPlanningScores): boolean;
    private computePlanningScore;
    private computeCompositionScore;
    private computeBrandScore;
}
//# sourceMappingURL=visual-planning-scorer.d.ts.map