import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import { AudioContinuityPlan, AudioMixingPlan, AudioSynchronizationProfile, AudioSyncPlanType, MusicSynchronizationPlan, SceneSynchronizationPlan, SoundEffectSynchronizationPlan, SubtitleSynchronizationPlan, VoiceSynchronizationPlan, PlatformAudioSyncOptimization } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare class AudioSynchronizationAnalyzer {
    buildAudioSyncPlan(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, motionPlan: MotionGenerationRecord, animationPlan: AnimationGenerationRecord, vfxPlan: VisualEffectsGenerationRecord, version: number, input: AudioSynchronizationInputContext): AudioSynchronizationRecordDraft;
    buildProfile(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, motionPlan: MotionGenerationRecord, animationPlan: AnimationGenerationRecord, vfxPlan: VisualEffectsGenerationRecord, version: number): AudioSynchronizationProfile;
    buildVoiceSync(scene: SceneGenerationRecord, animationPlan: AnimationGenerationRecord, input: AudioSynchronizationInputContext): VoiceSynchronizationPlan;
    buildMusicSync(scene: SceneGenerationRecord, input: AudioSynchronizationInputContext): MusicSynchronizationPlan;
    buildSoundEffectSync(scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, vfxPlan: VisualEffectsGenerationRecord, input: AudioSynchronizationInputContext): SoundEffectSynchronizationPlan;
    buildSubtitleSync(scene: SceneGenerationRecord, animationPlan: AnimationGenerationRecord): SubtitleSynchronizationPlan;
    buildAudioMixing(scene: SceneGenerationRecord): AudioMixingPlan;
    buildSceneSync(scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, motionPlan: MotionGenerationRecord, animationPlan: AnimationGenerationRecord, vfxPlan: VisualEffectsGenerationRecord): SceneSynchronizationPlan;
    buildContinuity(scene: SceneGenerationRecord): AudioContinuityPlan;
    buildPlatformOptimizations(platform: StoryboardGenerationPlatform): PlatformAudioSyncOptimization[];
    buildRecommendations(draft: AudioSynchronizationRecordDraft): string[];
}
export interface AudioSynchronizationInputContext {
    voiceFileIds?: string[];
    musicIds?: string[];
    soundEffectIds?: string[];
    scriptId?: string;
}
export interface AudioSynchronizationRecordDraft {
    audioSynchronizationId: string;
    profile: AudioSynchronizationProfile;
    planType: AudioSyncPlanType;
    voiceSynchronization: VoiceSynchronizationPlan;
    musicSynchronization: MusicSynchronizationPlan;
    soundEffectSynchronization: SoundEffectSynchronizationPlan;
    subtitleSynchronization: SubtitleSynchronizationPlan;
    audioMixing: AudioMixingPlan;
    sceneSynchronization: SceneSynchronizationPlan;
    continuity: AudioContinuityPlan;
    platformOptimizations: PlatformAudioSyncOptimization[];
}
//# sourceMappingURL=audio-synchronization-analyzer.d.ts.map