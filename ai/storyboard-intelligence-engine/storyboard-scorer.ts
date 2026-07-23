import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import {
  ContinuityCheck,
  ScenePlan,
  StoryboardScores,
  StoryFlow,
  TimingIntelligence,
} from "./types.js";

export class StoryboardScorer {
  computeScores(
    scenes: ScenePlan[],
    storyFlow: StoryFlow,
    timing: TimingIntelligence,
    continuity: ContinuityCheck,
    creative: CreativeDirectionRecord,
    strategy: MarketingStrategyRecord
  ): StoryboardScores {
    const storyboardQualityScore = this.computeStoryboardQuality(scenes, continuity);
    const storytellingScore = this.computeStorytellingScore(storyFlow, scenes);
    const visualPlanningScore = this.computeVisualPlanningScore(scenes, creative);
    const marketingScore = Math.min(100, strategy.scores.marketingReadinessScore);
    const brandConsistencyScore = this.computeBrandScore(continuity, creative);
    const aiConfidenceScore = Math.round(
      (storyboardQualityScore + storytellingScore + visualPlanningScore + marketingScore + brandConsistencyScore) / 5
    );

    return {
      storyboardQualityScore,
      storytellingScore,
      visualPlanningScore,
      marketingScore,
      brandConsistencyScore,
      aiConfidenceScore,
    };
  }

  isStoryboardValid(
    scores: StoryboardScores,
    scenes: ScenePlan[],
    continuity: ContinuityCheck
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scenes.length < 4) diagnostics.push("Insufficient scenes for production-ready storyboard (minimum 4)");
    if (!continuity.storyConsistency) diagnostics.push("Story flow sequence is not logically connected");
    if (!continuity.sceneConsistency) diagnostics.push("Scene numbering inconsistent");
    if (continuity.issues.length > 0) {
      diagnostics.push(...continuity.issues);
    }
    if (scores.storyboardQualityScore < 55) {
      diagnostics.push(`Storyboard quality score ${scores.storyboardQualityScore} below threshold (55)`);
    }
    if (scores.storytellingScore < 50) {
      diagnostics.push(`Storytelling score ${scores.storytellingScore} below threshold (50)`);
    }
    if (scores.visualPlanningScore < 50) {
      diagnostics.push(`Visual planning score ${scores.visualPlanningScore} below threshold (50)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    const hasHook = scenes.some((s) => s.scenePurpose === "hook");
    const hasCta = scenes.some((s) => s.scenePurpose === "call-to-action");
    if (!hasHook) diagnostics.push("Hook scene missing");
    if (!hasCta) diagnostics.push("CTA scene missing");

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scenes: ScenePlan[], continuity: ContinuityCheck, scores: StoryboardScores): boolean {
    return (
      scenes.length >= 5 &&
      continuity.storyConsistency &&
      continuity.productConsistency &&
      continuity.issues.length === 0 &&
      scores.storyboardQualityScore >= 55
    );
  }

  private computeStoryboardQuality(scenes: ScenePlan[], continuity: ContinuityCheck): number {
    let score = 50;
    if (scenes.length >= 5) score += 15;
    if (scenes.every((s) => s.visualObjective.length >= 15)) score += 10;
    if (continuity.issues.length === 0) score += 15;
    if (continuity.recommendations.length <= 1) score += 10;
    return Math.min(100, score);
  }

  private computeStorytellingScore(storyFlow: StoryFlow, scenes: ScenePlan[]): number {
    let score = 45;
    const flowFields = Object.values(storyFlow).filter((v) => v && !v.startsWith("N/A"));
    score += Math.min(30, flowFields.length * 3);
    if (scenes.some((s) => s.scenePurpose === "hook")) score += 10;
    if (scenes.some((s) => s.scenePurpose === "ending")) score += 10;
    return Math.min(100, score);
  }

  private computeVisualPlanningScore(scenes: ScenePlan[], creative: CreativeDirectionRecord): number {
    let score = 40;
    if (scenes.every((s) => s.cameraDirection && s.lightingDirection)) score += 20;
    if (scenes.every((s) => s.composition && s.backgroundStyle)) score += 20;
    if (creative.visualDirection.colorPalette.length >= 3) score += 10;
    if (scenes.every((s) => s.transitionIn && s.transitionOut)) score += 10;
    return Math.min(100, score);
  }

  private computeBrandScore(continuity: ContinuityCheck, creative: CreativeDirectionRecord): number {
    let score = 40;
    if (continuity.brandConsistency) score += 25;
    if (continuity.creativeConsistency) score += 15;
    if (creative.brandDirection.brandColors.length >= 2) score += 10;
    if (creative.brandDirection.brandConsistency.length >= 20) score += 10;
    return Math.min(100, score);
  }
}
