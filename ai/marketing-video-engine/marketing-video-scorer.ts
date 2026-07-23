import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { MarketingVideoRecordDraft } from "./marketing-video-analyzer.js";
import { MarketingVideoScores } from "./types.js";

export class MarketingVideoScorer {
  computeScores(
    draft: MarketingVideoRecordDraft,
    storyboard: StoryboardGenerationRecord,
    scenes: SceneGenerationRecord[],
    audioPlans: AudioSynchronizationRecord[]
  ): MarketingVideoScores {
    const marketingQualityScore = this.computeMarketingQuality(draft, storyboard);
    const engagementScore = this.computeEngagement(draft);
    const conversionScore = this.computeConversion(draft, storyboard);
    const brandConsistencyScore = this.computeBrandConsistency(storyboard, scenes);
    const platformReadinessScore = this.computePlatformReadiness(draft, storyboard);
    const aiConfidenceScore = Math.round(
      (marketingQualityScore + engagementScore + conversionScore + brandConsistencyScore + platformReadinessScore) / 5
    );

    return {
      marketingQualityScore,
      engagementScore,
      conversionScore,
      brandConsistencyScore,
      platformReadinessScore,
      aiConfidenceScore,
    };
  }

  isPlanValid(scores: MarketingVideoScores, draft: MarketingVideoRecordDraft): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (!draft.hookOptimization.first3SecondsStrategy) diagnostics.push("First 3 seconds strategy required");
    if (!draft.callToAction.ctaTiming) diagnostics.push("CTA timing required");
    if (draft.abTestPreparation.hookVariants.length < 2) diagnostics.push("A/B hook variants required");
    if (scores.marketingQualityScore < 55) {
      diagnostics.push(`Marketing quality score ${scores.marketingQualityScore} below threshold (55)`);
    }
    if (scores.engagementScore < 50) {
      diagnostics.push(`Engagement score ${scores.engagementScore} below threshold (50)`);
    }
    if (scores.conversionScore < 50) {
      diagnostics.push(`Conversion score ${scores.conversionScore} below threshold (50)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.platformReadinessScore < 55) {
      diagnostics.push(`Platform readiness score ${scores.platformReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: MarketingVideoScores, draft: MarketingVideoRecordDraft): boolean {
    return scores.platformReadinessScore >= 55 && draft.platformOptimizations.length >= 8;
  }

  isMarketingReady(scores: MarketingVideoScores, storyboard: StoryboardGenerationRecord): boolean {
    return scores.conversionScore >= 50 && storyboard.marketingReady;
  }

  isBrandConsistent(storyboard: StoryboardGenerationRecord, scenes: SceneGenerationRecord[]): boolean {
    return storyboard.brandConsistent && scenes.every((s) => s.brandConsistent);
  }

  private computeMarketingQuality(draft: MarketingVideoRecordDraft, storyboard: StoryboardGenerationRecord): number {
    let score = 45;
    if (draft.marketingStrategy.valueProposition.length > 5) score += 15;
    if (draft.hookOptimization.attentionHook.length > 5) score += 15;
    if (draft.productPresentation.productRevealTiming.length > 3) score += 15;
    if (storyboard.scores.marketingScore >= 50) score += 10;
    return Math.min(100, score);
  }

  private computeEngagement(draft: MarketingVideoRecordDraft): number {
    let score = 45;
    if (draft.engagementOptimization.curiosityTriggers.length >= 2) score += 20;
    if (draft.engagementOptimization.emotionalJourney.length > 10) score += 20;
    if (draft.hookOptimization.emotionalHook.length > 3) score += 15;
    return Math.min(100, score);
  }

  private computeConversion(draft: MarketingVideoRecordDraft, storyboard: StoryboardGenerationRecord): number {
    let score = 45;
    if (draft.callToAction.ctaPriority.length > 5) score += 20;
    if (draft.conversionOptimization.conversionPath.length > 5) score += 20;
    if (storyboard.marketingPlanning.conversionStrategy.length > 3) score += 15;
    return Math.min(100, score);
  }

  private computeBrandConsistency(storyboard: StoryboardGenerationRecord, scenes: SceneGenerationRecord[]): number {
    let score = storyboard.brandConsistent ? 60 : 45;
    if (scenes.every((s) => s.brandConsistent)) score += 25;
    if (storyboard.scores.marketingScore >= 55) score += 15;
    return Math.min(100, score);
  }

  private computePlatformReadiness(draft: MarketingVideoRecordDraft, storyboard: StoryboardGenerationRecord): number {
    let score = 45;
    if (draft.platformOptimizations.length >= 8) score += 25;
    if (storyboard.platformVariations.length >= 1) score += 15;
    if (draft.abTestPreparation.ctaVariants.length >= 3) score += 15;
    return Math.min(100, score);
  }
}
