import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import { SceneScriptPlan, ScriptPlanningScores, ScriptStructure, SubtitlePreparation, VoicePreparation } from "./types.js";
export declare class ScriptPlanningScorer {
    computeScores(scenePlans: SceneScriptPlan[], scriptStructure: ScriptStructure, voice: VoicePreparation, subtitles: SubtitlePreparation, storyboard: StoryboardIntelligenceRecord, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord): ScriptPlanningScores;
    isScriptPlanValid(scores: ScriptPlanningScores, scenePlans: SceneScriptPlan[], storyboard: StoryboardIntelligenceRecord, alignmentIssues: string[]): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scenePlans: SceneScriptPlan[], storyboard: StoryboardIntelligenceRecord, scores: ScriptPlanningScores): boolean;
    private computePlanningScore;
    private computeReadability;
    private computeBrandScore;
}
//# sourceMappingURL=script-planning-scorer.d.ts.map