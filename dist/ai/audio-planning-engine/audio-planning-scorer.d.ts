import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import { AudioPlanningScores, AudioSynchronization, MusicPlanning, SceneAudioPlan, VoicePlanning } from "./types.js";
export declare class AudioPlanningScorer {
    computeScores(sceneAudioPlans: SceneAudioPlan[], voice: VoicePlanning, music: MusicPlanning, sync: AudioSynchronization, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord): AudioPlanningScores;
    isAudioPlanValid(scores: AudioPlanningScores, sceneAudioPlans: SceneAudioPlan[], storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, alignmentIssues: string[]): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(sceneAudioPlans: SceneAudioPlan[], storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, scores: AudioPlanningScores): boolean;
    private computePlanningScore;
    private computeVoiceScore;
    private computeMusicScore;
    private computeSyncScore;
    private computeBrandScore;
}
//# sourceMappingURL=audio-planning-scorer.d.ts.map