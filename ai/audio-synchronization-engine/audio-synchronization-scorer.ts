import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import type { AudioSynchronizationRecordDraft } from "./audio-synchronization-analyzer.js";
import { AudioSynchronizationScores } from "./types.js";

export class AudioSynchronizationScorer {
  computeScores(
    draft: AudioSynchronizationRecordDraft,
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    animationPlan: AnimationGenerationRecord,
    vfxPlan: VisualEffectsGenerationRecord
  ): AudioSynchronizationScores {
    const audioSynchronizationScore = this.computeAudioSync(draft, scene);
    const lipSyncScore = this.computeLipSync(draft, animationPlan);
    const musicAlignmentScore = this.computeMusicAlignment(draft, scene);
    const subtitleQualityScore = this.computeSubtitleQuality(draft);
    const productionReadinessScore = this.computeProductionReadiness(
      draft,
      scene,
      motionPlan,
      cameraPlan,
      animationPlan,
      vfxPlan
    );
    const aiConfidenceScore = Math.round(
      (audioSynchronizationScore + lipSyncScore + musicAlignmentScore + subtitleQualityScore + productionReadinessScore) / 5
    );

    return {
      audioSynchronizationScore,
      lipSyncScore,
      musicAlignmentScore,
      subtitleQualityScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isPlanValid(scores: AudioSynchronizationScores, draft: AudioSynchronizationRecordDraft): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (draft.sceneSynchronization.motionSync.length < 1) diagnostics.push("Motion synchronization required");
    if (draft.sceneSynchronization.voiceSync.length < 1) diagnostics.push("Voice synchronization required");
    if (!draft.voiceSynchronization.lipSyncBlueprint || draft.voiceSynchronization.lipSyncBlueprint === "N/A") {
      diagnostics.push("Lip sync blueprint required");
    }
    if (scores.audioSynchronizationScore < 55) {
      diagnostics.push(`Audio synchronization score ${scores.audioSynchronizationScore} below threshold (55)`);
    }
    if (scores.lipSyncScore < 50) {
      diagnostics.push(`Lip sync score ${scores.lipSyncScore} below threshold (50)`);
    }
    if (scores.musicAlignmentScore < 50) {
      diagnostics.push(`Music alignment score ${scores.musicAlignmentScore} below threshold (50)`);
    }
    if (scores.subtitleQualityScore < 50) {
      diagnostics.push(`Subtitle quality score ${scores.subtitleQualityScore} below threshold (50)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: AudioSynchronizationScores, draft: AudioSynchronizationRecordDraft): boolean {
    return scores.productionReadinessScore >= 55 && draft.platformOptimizations.length >= 7;
  }

  isBrandConsistent(scene: SceneGenerationRecord): boolean {
    return scene.brandConsistent;
  }

  isAudioContinuityMaintained(draft: AudioSynchronizationRecordDraft): boolean {
    return draft.continuity.voiceContinuity && draft.continuity.effectContinuity && draft.continuity.issues.length === 0;
  }

  private computeAudioSync(draft: AudioSynchronizationRecordDraft, scene: SceneGenerationRecord): number {
    let score = 45;
    if (draft.voiceSynchronization.voiceTiming.length > 3) score += 15;
    if (draft.musicSynchronization.musicTiming.length > 3) score += 15;
    if (draft.sceneSynchronization.motionSync.length >= 1) score += 15;
    if (scene.structure.sceneObjectives.length >= 1) score += 10;
    return Math.min(100, score);
  }

  private computeLipSync(draft: AudioSynchronizationRecordDraft, animationPlan: AnimationGenerationRecord): number {
    let score = 45;
    if (draft.voiceSynchronization.lipSyncBlueprint.length > 5) score += 25;
    if (animationPlan.characterAnimation.lipMovementPlan.length > 5) score += 20;
    if (draft.voiceSynchronization.speechAlignment.length > 5) score += 10;
    return Math.min(100, score);
  }

  private computeMusicAlignment(draft: AudioSynchronizationRecordDraft, scene: SceneGenerationRecord): number {
    let score = 45;
    if (draft.musicSynchronization.beatDetection.length > 5) score += 20;
    if (draft.musicSynchronization.rhythmAlignment.length > 5) score += 20;
    if (scene.audioPlanning.musicTiming.length > 3) score += 15;
    return Math.min(100, score);
  }

  private computeSubtitleQuality(draft: AudioSynchronizationRecordDraft): number {
    let score = 45;
    if (draft.subtitleSynchronization.subtitleTiming.length > 5) score += 20;
    if (draft.subtitleSynchronization.readingSpeedValidation.length > 5) score += 20;
    if (draft.subtitleSynchronization.captionStyling.length > 5) score += 15;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    draft: AudioSynchronizationRecordDraft,
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    animationPlan: AnimationGenerationRecord,
    vfxPlan: VisualEffectsGenerationRecord
  ): number {
    let score = 45;
    if (
      scene.productionReady &&
      motionPlan.productionReady &&
      cameraPlan.productionReady &&
      animationPlan.productionReady &&
      vfxPlan.productionReady
    ) {
      score += 25;
    }
    if (draft.platformOptimizations.length >= 7) score += 15;
    if (draft.audioMixing.loudnessNormalization.length >= 5) score += 15;
    return Math.min(100, score);
  }
}
