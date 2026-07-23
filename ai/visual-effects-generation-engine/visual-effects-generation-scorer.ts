import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { VisualEffectsGenerationRecordDraft } from "./visual-effects-generation-analyzer.js";
import { VisualEffectsGenerationScores } from "./types.js";

export class VisualEffectsGenerationScorer {
  computeScores(
    draft: VisualEffectsGenerationRecordDraft,
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    animationPlan: AnimationGenerationRecord
  ): VisualEffectsGenerationScores {
    const visualEffectsScore = this.computeVisualEffects(draft, scene);
    const cinematicScore = this.computeCinematic(draft, scene, cameraPlan);
    const synchronizationScore = this.computeSync(draft.synchronization);
    const brandConsistencyScore = this.computeBrandConsistency(scene);
    const productionReadinessScore = this.computeProductionReadiness(
      draft,
      scene,
      motionPlan,
      cameraPlan,
      animationPlan
    );
    const aiConfidenceScore = Math.round(
      (visualEffectsScore + cinematicScore + synchronizationScore + brandConsistencyScore + productionReadinessScore) / 5
    );

    return {
      visualEffectsScore,
      cinematicScore,
      synchronizationScore,
      brandConsistencyScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isPlanValid(scores: VisualEffectsGenerationScores, draft: VisualEffectsGenerationRecordDraft): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (draft.synchronization.motionSync.length < 1) diagnostics.push("Motion synchronization required");
    if (draft.synchronization.animationSync.length < 1) diagnostics.push("Animation synchronization required");
    if (scores.visualEffectsScore < 55) {
      diagnostics.push(`Visual effects score ${scores.visualEffectsScore} below threshold (55)`);
    }
    if (scores.cinematicScore < 50) {
      diagnostics.push(`Cinematic score ${scores.cinematicScore} below threshold (50)`);
    }
    if (scores.synchronizationScore < 50) {
      diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (50)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: VisualEffectsGenerationScores, draft: VisualEffectsGenerationRecordDraft): boolean {
    return scores.productionReadinessScore >= 55 && draft.platformOptimizations.length >= 7;
  }

  isBrandConsistent(scene: SceneGenerationRecord): boolean {
    return scene.brandConsistent;
  }

  isCinematicallyConsistent(scores: VisualEffectsGenerationScores, draft: VisualEffectsGenerationRecordDraft): boolean {
    return scores.cinematicScore >= 50 && draft.lightingEffects.volumetricLighting.length >= 5;
  }

  private computeVisualEffects(draft: VisualEffectsGenerationRecordDraft, scene: SceneGenerationRecord): number {
    let score = 45;
    if (draft.lightingEffects.glow.length > 5) score += 10;
    if (draft.atmosphericEffects.particles.length > 3) score += 10;
    if (draft.productEffects.productGlow.length > 5) score += 10;
    if (draft.colorEffects.colorGrading.length > 5) score += 10;
    if (scene.structure.sceneObjectives.length >= 1) score += 15;
    return Math.min(100, score);
  }

  private computeCinematic(
    draft: VisualEffectsGenerationRecordDraft,
    scene: SceneGenerationRecord,
    cameraPlan: CameraDirectorRecord
  ): number {
    let score = 45;
    if (draft.cinematicEffects.depthOfField.length > 5) score += 15;
    if (draft.lightingEffects.volumetricLighting.length > 5) score += 15;
    if (cameraPlan.shotPlans.length >= 1) score += 15;
    if (scene.scores.cinematicScore >= 50) score += 10;
    return Math.min(100, score);
  }

  private computeSync(sync: VisualEffectsGenerationRecordDraft["synchronization"]): number {
    let score = 40;
    if (sync.motionSync.length >= 1) score += 15;
    if (sync.cameraSync.length >= 1) score += 15;
    if (sync.audioSync.length >= 1) score += 10;
    if (sync.animationSync.length >= 1) score += 10;
    if (sync.sceneTimingSync.length >= 1) score += 10;
    return Math.min(100, score);
  }

  private computeBrandConsistency(scene: SceneGenerationRecord): number {
    return scene.brandConsistent ? Math.min(100, scene.scores.brandConsistencyScore + 10) : scene.scores.brandConsistencyScore;
  }

  private computeProductionReadiness(
    draft: VisualEffectsGenerationRecordDraft,
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    animationPlan: AnimationGenerationRecord
  ): number {
    let score = 45;
    if (scene.productionReady && motionPlan.productionReady && cameraPlan.productionReady && animationPlan.productionReady) {
      score += 25;
    }
    if (draft.platformOptimizations.length >= 7) score += 15;
    if (draft.synchronization.transitionSync.length >= 1) score += 15;
    return Math.min(100, score);
  }
}
