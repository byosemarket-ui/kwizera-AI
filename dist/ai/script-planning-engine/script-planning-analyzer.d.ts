import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import { PlatformScriptRules, SceneScriptPlan, ScriptPlanningInput, ScriptPlanningProfile, ScriptStructure, SubtitlePreparation, VoicePreparation } from "./types.js";
export declare class ScriptPlanningAnalyzer {
    buildProfile(input: ScriptPlanningInput, storyboard: StoryboardIntelligenceRecord, version: number, language: string): ScriptPlanningProfile;
    buildScriptStructure(storyboard: StoryboardIntelligenceRecord): ScriptStructure;
    buildScenePlans(storyboard: StoryboardIntelligenceRecord, understanding: ProductUnderstandingRecord, creative: CreativeDirectionRecord, language: string): SceneScriptPlan[];
    buildVoicePreparation(creative: CreativeDirectionRecord, storyboard: StoryboardIntelligenceRecord, understanding: ProductUnderstandingRecord): VoicePreparation;
    buildSubtitlePreparation(scenePlans: SceneScriptPlan[], storyboard: StoryboardIntelligenceRecord): SubtitlePreparation;
    buildPlatformRules(storyboard: StoryboardIntelligenceRecord): PlatformScriptRules;
    validateSceneAlignment(scenePlans: SceneScriptPlan[], storyboard: StoryboardIntelligenceRecord): {
        aligned: boolean;
        issues: string[];
    };
    private buildSceneScriptPlan;
}
//# sourceMappingURL=script-planning-analyzer.d.ts.map