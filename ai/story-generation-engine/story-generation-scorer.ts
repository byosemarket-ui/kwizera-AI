import {
  GeneratedScene,
  StoryboardGenerationScores,
  StoryStructure,
  VisualPlanning,
  AudioPlanning,
  MarketingPlanning,
  CinematicPlanning,
  PlatformStoryboardVariation,
} from "./types.js";
import type { GenerationContext } from "./story-generation-analyzer.js";

export class StoryGenerationScorer {
  computeScores(
    scenes: GeneratedScene[],
    storyStructure: StoryStructure,
    visualPlanning: VisualPlanning,
    audioPlanning: AudioPlanning,
    marketingPlanning: MarketingPlanning,
    cinematicPlanning: CinematicPlanning,
    platformVariations: PlatformStoryboardVariation[],
    context: GenerationContext
  ): StoryboardGenerationScores {
    const storyQualityScore = this.computeStoryQuality(scenes, storyStructure);
    const marketingScore = this.computeMarketingScore(marketingPlanning, storyStructure);
    const creativeScore = this.computeCreativeScore(visualPlanning, cinematicPlanning, context);
    const cinematicScore = this.computeCinematicScore(scenes, cinematicPlanning);
    const productionReadinessScore = this.computeProductionReadiness(scenes, visualPlanning, audioPlanning);
    const aiConfidenceScore = Math.round(
      (storyQualityScore + marketingScore + creativeScore + cinematicScore + productionReadinessScore) / 5
    );

    return {
      storyQualityScore,
      marketingScore,
      creativeScore,
      cinematicScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isStoryboardValid(
    scores: StoryboardGenerationScores,
    scenes: GeneratedScene[]
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scenes.length < 4) diagnostics.push("Insufficient scenes for production-ready storyboard (minimum 4)");
    if (scores.storyQualityScore < 55) {
      diagnostics.push(`Story quality score ${scores.storyQualityScore} below threshold (55)`);
    }
    if (scores.marketingScore < 50) {
      diagnostics.push(`Marketing score ${scores.marketingScore} below threshold (50)`);
    }
    if (scores.creativeScore < 50) {
      diagnostics.push(`Creative score ${scores.creativeScore} below threshold (50)`);
    }
    if (scores.cinematicScore < 50) {
      diagnostics.push(`Cinematic score ${scores.cinematicScore} below threshold (50)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    const totalShots = scenes.reduce((s, sc) => s + sc.shots.length, 0);
    if (totalShots < scenes.length) diagnostics.push("Each scene must have at least one shot");

    const hasHook = scenes.some((s) => s.scenePurpose === "opening-hook");
    const hasCta = scenes.some((s) => s.scenePurpose === "call-to-action");
    if (!hasHook) diagnostics.push("Opening hook scene missing");
    if (!hasCta) diagnostics.push("CTA scene missing");

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: StoryboardGenerationScores, scenes: GeneratedScene[]): boolean {
    return (
      scenes.length >= 5 &&
      scores.productionReadinessScore >= 55 &&
      scores.storyQualityScore >= 55 &&
      scenes.every((s) => s.shots.length >= 1)
    );
  }

  isMarketingReady(scores: StoryboardGenerationScores, storyStructure: StoryStructure): boolean {
    return (
      scores.marketingScore >= 50 &&
      storyStructure.callToAction.length >= 10 &&
      (!storyStructure.socialProof.startsWith("N/A") || storyStructure.benefits.length >= 10)
    );
  }

  isBrandConsistent(context: GenerationContext, visualPlanning: VisualPlanning): boolean {
    if (!context.brandName) return visualPlanning.branding.length >= 10;
    return (
      visualPlanning.branding.toLowerCase().includes(context.brandName.toLowerCase()) ||
      visualPlanning.colorStyle.length >= 5
    );
  }

  private computeStoryQuality(scenes: GeneratedScene[], storyStructure: StoryStructure): number {
    let score = 45;
    const flowFields = Object.values(storyStructure).filter((v) => v && !v.startsWith("N/A"));
    score += Math.min(25, flowFields.length * 3);
    if (scenes.length >= 5) score += 15;
    if (scenes.every((s) => s.sceneObjective.length >= 15)) score += 15;
    return Math.min(100, score);
  }

  private computeMarketingScore(marketingPlanning: MarketingPlanning, storyStructure: StoryStructure): number {
    let score = 45;
    if (marketingPlanning.conversionStrategy.length >= 20) score += 15;
    if (marketingPlanning.ctaPlacement.length >= 10) score += 15;
    if (marketingPlanning.productReveal.length >= 15) score += 10;
    if (storyStructure.callToAction.length >= 10) score += 15;
    return Math.min(100, score);
  }

  private computeCreativeScore(
    visualPlanning: VisualPlanning,
    cinematicPlanning: CinematicPlanning,
    context: GenerationContext
  ): number {
    let score = 40;
    if (visualPlanning.composition && visualPlanning.lighting) score += 15;
    if (visualPlanning.colorStyle && visualPlanning.background) score += 15;
    if (visualPlanning.typography && visualPlanning.graphics) score += 10;
    if (cinematicPlanning.visualArc && cinematicPlanning.emotionalArc) score += 10;
    if (context.creative) score += 10;
    return Math.min(100, score);
  }

  private computeCinematicScore(scenes: GeneratedScene[], cinematicPlanning: CinematicPlanning): number {
    let score = 40;
    const totalShots = scenes.reduce((s, sc) => s + sc.shots.length, 0);
    if (totalShots >= scenes.length * 2) score += 20;
    if (scenes.every((s) => s.shots.every((sh) => sh.cameraAngle && sh.cameraMovement))) score += 20;
    if (cinematicPlanning.pacing && cinematicPlanning.transitionStrategy) score += 20;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    scenes: GeneratedScene[],
    visualPlanning: VisualPlanning,
    audioPlanning: AudioPlanning
  ): number {
    let score = 45;
    if (scenes.every((s) => s.sceneDuration && s.sceneAssets.length >= 1)) score += 15;
    if (scenes.every((s) => s.shots.length >= 1)) score += 15;
    if (visualPlanning.composition && audioPlanning.voiceTiming) score += 15;
    if (audioPlanning.audioSynchronization) score += 10;
    return Math.min(100, score);
  }
}
