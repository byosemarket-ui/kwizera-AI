import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import { AudioPlanningInput, AudioPlanningProfile, AudioSynchronization, EmotionalFlowPlanning, MusicPlanning, PlatformAudioRules, SceneAudioPlan, SoundEffectPlanning, VoicePlanning } from "./types.js";
export declare class AudioPlanningAnalyzer {
    buildProfile(input: AudioPlanningInput, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, version: number, language: string): AudioPlanningProfile;
    buildSceneAudioPlans(storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, creative: CreativeDirectionRecord): SceneAudioPlan[];
    buildVoicePlanning(scriptPlan: ScriptPlanningRecord, creative: CreativeDirectionRecord, storyboard: StoryboardIntelligenceRecord): VoicePlanning;
    buildMusicPlanning(creative: CreativeDirectionRecord, storyboard: StoryboardIntelligenceRecord): MusicPlanning;
    buildSoundEffectPlanning(storyboard: StoryboardIntelligenceRecord): SoundEffectPlanning;
    buildSynchronization(storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord): AudioSynchronization;
    buildEmotionalFlow(creative: CreativeDirectionRecord, storyboard: StoryboardIntelligenceRecord): EmotionalFlowPlanning;
    buildPlatformRules(storyboard: StoryboardIntelligenceRecord): PlatformAudioRules;
    validateAlignment(sceneAudioPlans: SceneAudioPlan[], storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord): {
        aligned: boolean;
        issues: string[];
    };
}
//# sourceMappingURL=audio-planning-analyzer.d.ts.map