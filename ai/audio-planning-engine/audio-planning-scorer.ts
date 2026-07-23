import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import {
  AudioPlanningScores,
  AudioSynchronization,
  MusicPlanning,
  SceneAudioPlan,
  VoicePlanning,
} from "./types.js";

export class AudioPlanningScorer {
  computeScores(
    sceneAudioPlans: SceneAudioPlan[],
    voice: VoicePlanning,
    music: MusicPlanning,
    sync: AudioSynchronization,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    creative: CreativeDirectionRecord,
    strategy: MarketingStrategyRecord
  ): AudioPlanningScores {
    const audioPlanningScore = this.computePlanningScore(sceneAudioPlans, storyboard, scriptPlan, visualPlan);
    const voicePlanningScore = this.computeVoiceScore(voice, scriptPlan);
    const musicPlanningScore = this.computeMusicScore(music);
    const synchronizationScore = this.computeSyncScore(sync, sceneAudioPlans, scriptPlan);
    const brandConsistencyScore = this.computeBrandScore(voice, creative);
    const marketingScore = Math.min(100, strategy.scores.marketingReadinessScore);
    const aiConfidenceScore = Math.round(
      (audioPlanningScore + voicePlanningScore + musicPlanningScore + synchronizationScore + brandConsistencyScore + marketingScore) / 6
    );

    return {
      audioPlanningScore,
      voicePlanningScore,
      musicPlanningScore,
      synchronizationScore,
      brandConsistencyScore,
      aiConfidenceScore,
    };
  }

  isAudioPlanValid(
    scores: AudioPlanningScores,
    sceneAudioPlans: SceneAudioPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    alignmentIssues: string[]
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (alignmentIssues.length > 0) diagnostics.push(...alignmentIssues);
    if (sceneAudioPlans.length !== storyboard.scenes.length) {
      diagnostics.push("Scene audio plans must match every storyboard scene");
    }
    if (!sceneAudioPlans.every((s) => s.plannedVoiceOver.startsWith("Plan voice-over"))) {
      diagnostics.push("Every scene must have planned voice-over instructions");
    }
    if (scores.audioPlanningScore < 55) {
      diagnostics.push(`Audio planning score ${scores.audioPlanningScore} below threshold (55)`);
    }
    if (scores.voicePlanningScore < 50) {
      diagnostics.push(`Voice planning score ${scores.voicePlanningScore} below threshold (50)`);
    }
    if (scores.musicPlanningScore < 50) {
      diagnostics.push(`Music planning score ${scores.musicPlanningScore} below threshold (50)`);
    }
    if (scores.synchronizationScore < 50) {
      diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (50)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(
    sceneAudioPlans: SceneAudioPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    scores: AudioPlanningScores
  ): boolean {
    return (
      storyboard.productionReady &&
      scriptPlan.productionReady &&
      visualPlan.productionReady &&
      sceneAudioPlans.length === storyboard.scenes.length &&
      sceneAudioPlans.every((s) => s.plannedVoiceOver.startsWith("Plan voice-over")) &&
      scores.audioPlanningScore >= 55
    );
  }

  private computePlanningScore(
    sceneAudioPlans: SceneAudioPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord
  ): number {
    let score = 50;
    if (sceneAudioPlans.length === storyboard.scenes.length) score += 15;
    if (sceneAudioPlans.length === scriptPlan.scenePlans.length) score += 10;
    if (sceneAudioPlans.length === visualPlan.scenePlans.length) score += 10;
    if (sceneAudioPlans.every((s) => s.plannedSfx.length >= 1)) score += 10;
    if (sceneAudioPlans.every((s) => s.transitionAudio.startsWith("Plan transition"))) score += 5;
    return Math.min(100, score);
  }

  private computeVoiceScore(voice: VoicePlanning, scriptPlan: ScriptPlanningRecord): number {
    let score = 45;
    if (voice.voiceStyle) score += 15;
    if (voice.emphasisPoints.length >= 2) score += 10;
    if (voice.pronunciationRules.length >= 2) score += 10;
    if (Object.keys(voice.readingDuration).length === scriptPlan.scenePlans.length) score += 10;
    if (Object.keys(voice.pauseTiming).length >= scriptPlan.scenePlans.length) score += 10;
    return Math.min(100, score);
  }

  private computeMusicScore(music: MusicPlanning): number {
    let score = 45;
    if (music.introMusic.startsWith("Plan intro")) score += 15;
    if (music.backgroundMusic.startsWith("Plan background")) score += 15;
    if (music.endingMusic.startsWith("Plan ending")) score += 10;
    if (music.fadeIn && music.fadeOut) score += 10;
    if (music.volumeStrategy) score += 5;
    return Math.min(100, score);
  }

  private computeSyncScore(
    sync: AudioSynchronization,
    sceneAudioPlans: SceneAudioPlan[],
    scriptPlan: ScriptPlanningRecord
  ): number {
    let score = 45;
    if (Object.keys(sync.voiceTiming).length === sceneAudioPlans.length) score += 15;
    if (Object.keys(sync.subtitleTiming).length === sceneAudioPlans.length) score += 15;
    if (Object.keys(sync.sceneTiming).length === sceneAudioPlans.length) score += 10;
    if (sync.ctaTiming) score += 10;
    if (Object.keys(sync.musicTiming).length === scriptPlan.scenePlans.length) score += 5;
    return Math.min(100, score);
  }

  private computeBrandScore(voice: VoicePlanning, creative: CreativeDirectionRecord): number {
    let score = 45;
    if (voice.voiceStyle === creative.brandDirection.brandVoice || voice.voiceStyle) score += 15;
    if (voice.emphasisPoints.some((p) => p.includes(creative.profile.brand))) score += 15;
    if (voice.pronunciationRules.some((r) => r.includes(creative.profile.brand))) score += 15;
    if (voice.speakingTone.includes(creative.profile.tone.split(" ")[0] ?? "")) score += 10;
    return Math.min(100, score);
  }
}
