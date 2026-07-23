import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { RenderingUpstreamAssets, RenderingPreparationRecordDraft } from "./rendering-preparation-analyzer.js";
import { RenderingPreparationScores } from "./types.js";

export class RenderingPreparationScorer {
  computeScores(
    draft: RenderingPreparationRecordDraft,
    storyboard: StoryboardGenerationRecord,
    _upstream: RenderingUpstreamAssets
  ): RenderingPreparationScores {
    const renderReadinessScore = this.computeRenderReadiness(draft, storyboard);
    const assetQualityScore = this.computeAssetQuality(draft);
    const timelineIntegrityScore = this.computeTimelineIntegrity(draft);
    const performanceScore = this.computePerformance(draft);
    const platformCompatibilityScore = this.computePlatformCompatibility(draft);
    const aiConfidenceScore = Math.round(
      (renderReadinessScore +
        assetQualityScore +
        timelineIntegrityScore +
        performanceScore +
        platformCompatibilityScore) /
        5
    );

    return {
      renderReadinessScore,
      assetQualityScore,
      timelineIntegrityScore,
      performanceScore,
      platformCompatibilityScore,
      aiConfidenceScore,
    };
  }

  isPlanValid(scores: RenderingPreparationScores, draft: RenderingPreparationRecordDraft): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (!draft.renderValidation.allValidated) {
      diagnostics.push(`Render validation failed: ${draft.renderValidation.issues.join("; ")}`);
    }
    if (!draft.dependencyValidation.allDependenciesReady) {
      diagnostics.push(`Missing dependencies: ${draft.dependencyValidation.missingDependencies.join(", ")}`);
    }
    if (!draft.assetValidation.allAssetsReady) diagnostics.push("Asset validation incomplete");
    if (!draft.timelineValidation.allTimelinesValid) diagnostics.push("Timeline validation incomplete");
    if (draft.timelineValidation.renderTimeline.length < 4) diagnostics.push("Render timeline incomplete");
    if (scores.renderReadinessScore < 55) {
      diagnostics.push(`Render readiness score ${scores.renderReadinessScore} below threshold (55)`);
    }
    if (scores.assetQualityScore < 50) {
      diagnostics.push(`Asset quality score ${scores.assetQualityScore} below threshold (50)`);
    }
    if (scores.timelineIntegrityScore < 50) {
      diagnostics.push(`Timeline integrity score ${scores.timelineIntegrityScore} below threshold (50)`);
    }
    if (scores.platformCompatibilityScore < 50) {
      diagnostics.push(`Platform compatibility score ${scores.platformCompatibilityScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isRenderReady(scores: RenderingPreparationScores, draft: RenderingPreparationRecordDraft): boolean {
    return scores.renderReadinessScore >= 55 && draft.outputProfiles.length >= 9 && draft.renderJobs.length >= 1;
  }

  isBrandConsistent(storyboard: StoryboardGenerationRecord, upstream: RenderingUpstreamAssets): boolean {
    return (
      storyboard.brandConsistent &&
      upstream.marketingPlan.brandConsistent &&
      upstream.productionPlan.brandConsistent &&
      upstream.scenes.every((s) => s.brandConsistent)
    );
  }

  private computeRenderReadiness(draft: RenderingPreparationRecordDraft, storyboard: StoryboardGenerationRecord): number {
    let score = 45;
    if (draft.renderValidation.allValidated) score += 25;
    if (storyboard.productionReady) score += 15;
    if (draft.renderSettings.resolution.length > 3) score += 15;
    return Math.min(100, score);
  }

  private computeAssetQuality(draft: RenderingPreparationRecordDraft): number {
    let score = 45;
    if (draft.assetValidation.allAssetsReady) score += 30;
    if (draft.assetValidation.logos.length > 3) score += 15;
    if (draft.assetValidation.voice.length > 3) score += 10;
    return Math.min(100, score);
  }

  private computeTimelineIntegrity(draft: RenderingPreparationRecordDraft): number {
    let score = 45;
    if (draft.timelineValidation.sceneTimelineValid) score += 10;
    if (draft.timelineValidation.audioTimelineValid) score += 10;
    if (draft.timelineValidation.renderTimelineValid) score += 15;
    if (draft.timelineValidation.effectTimelineValid) score += 10;
    if (draft.timelineValidation.allTimelinesValid) score += 10;
    return Math.min(100, score);
  }

  private computePerformance(draft: RenderingPreparationRecordDraft): number {
    let score = 70;
    if (draft.resourcePlanning.renderQueue.length > 5) score += 15;
    if (draft.recoveryPlan.rollbackPoints.length >= 3) score += 15;
    return Math.min(100, score);
  }

  private computePlatformCompatibility(draft: RenderingPreparationRecordDraft): number {
    if (draft.outputProfiles.length >= 9) return 100;
    return Math.max(0, Math.round((draft.outputProfiles.length / 9) * 100));
  }
}
