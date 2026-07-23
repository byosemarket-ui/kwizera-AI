import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import { BackgroundPlanning, BrandConsistencyCheck, CameraPlanning, GraphicElementsPlan, SceneVisualPlan, VisualPlanningInput, VisualPlanningProfile, VisualStylePlanning } from "./types.js";
export declare class VisualPlanningAnalyzer {
    buildProfile(input: VisualPlanningInput, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, understanding: ProductUnderstandingRecord, version: number): VisualPlanningProfile;
    buildScenePlans(storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, creative: CreativeDirectionRecord, understanding: ProductUnderstandingRecord): SceneVisualPlan[];
    buildBackgroundPlanning(creative: CreativeDirectionRecord, storyboard: StoryboardIntelligenceRecord): BackgroundPlanning;
    buildCameraPlanning(creative: CreativeDirectionRecord, storyboard: StoryboardIntelligenceRecord): CameraPlanning;
    buildVisualStyle(creative: CreativeDirectionRecord, understanding: ProductUnderstandingRecord): VisualStylePlanning;
    buildBrandConsistency(creative: CreativeDirectionRecord, scenePlans: SceneVisualPlan[]): BrandConsistencyCheck;
    buildGraphicElements(creative: CreativeDirectionRecord, understanding: ProductUnderstandingRecord): GraphicElementsPlan;
    validateSceneAlignment(scenePlans: SceneVisualPlan[], storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord): {
        aligned: boolean;
        issues: string[];
    };
    private buildSceneVisualPlan;
}
//# sourceMappingURL=visual-planning-analyzer.d.ts.map