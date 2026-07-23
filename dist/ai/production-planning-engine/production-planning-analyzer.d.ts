import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import { AssetManagement, DependencyValidation, ExportPreparation, PlannedAsset, PlatformProductionRules, ProductionPlanningInput, ProductionPlanningProfile, ProductionWorkflow, RecoveryPlan, RenderPreparation, SceneProductionPlan } from "./types.js";
export declare class ProductionPlanningAnalyzer {
    buildProfile(input: ProductionPlanningInput, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, version: number): ProductionPlanningProfile;
    buildWorkflow(storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord): ProductionWorkflow;
    buildAssetManagement(storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, creative: CreativeDirectionRecord): AssetManagement;
    buildDependencyValidation(foundation: AiProductIntelligenceFoundation, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord): DependencyValidation;
    buildRenderPreparation(storyboard: StoryboardIntelligenceRecord): RenderPreparation;
    buildExportPreparation(storyboard: StoryboardIntelligenceRecord): ExportPreparation;
    buildRecoveryPlan(productionPlanId: string): RecoveryPlan;
    buildPlatformRules(storyboard: StoryboardIntelligenceRecord): PlatformProductionRules;
    buildSceneProductionPlans(storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord): SceneProductionPlan[];
    validateAlignment(sceneProductionPlans: SceneProductionPlan[], storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord): {
        aligned: boolean;
        issues: string[];
    };
    getAllRequiredAssets(assets: AssetManagement): PlannedAsset[];
}
//# sourceMappingURL=production-planning-analyzer.d.ts.map