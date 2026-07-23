import {
  CompositionPlan,
  ColorPlan,
  ImageVariation,
  LightingPlan,
  PlatformImageOptimization,
  PromptAnalysis,
  StylePlan,
  TextToImageGenerationRecord,
  TextToImageScores,
} from "./types.js";
import type { GenerationContext } from "./text-to-image-generation-analyzer.js";

export class TextToImageGenerationScorer {
  computeScores(
    promptAnalysis: PromptAnalysis,
    compositionPlan: CompositionPlan,
    lightingPlan: LightingPlan,
    stylePlan: StylePlan,
    colorPlan: ColorPlan,
    platformOptimizations: PlatformImageOptimization[],
    variations: ImageVariation[],
    context: GenerationContext
  ): TextToImageScores {
    const promptQualityScore = this.computePromptQuality(promptAnalysis, context);
    const compositionScore = this.computeCompositionScore(compositionPlan);
    const styleScore = this.computeStyleScore(stylePlan, promptAnalysis);
    const brandConsistencyScore = this.computeBrandConsistency(context, colorPlan, stylePlan);
    const productionReadinessScore = this.computeProductionReadiness(
      compositionPlan,
      lightingPlan,
      colorPlan,
      platformOptimizations,
      variations
    );
    const aiConfidenceScore = Math.round(
      (promptQualityScore +
        compositionScore +
        styleScore +
        brandConsistencyScore +
        productionReadinessScore) /
        5
    );

    return {
      promptQualityScore,
      compositionScore,
      styleScore,
      brandConsistencyScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isImagePlanValid(
    scores: TextToImageScores,
    record: Pick<TextToImageGenerationRecord, "promptAnalysis" | "compositionPlan" | "lightingPlan">
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.promptQualityScore < 55) {
      diagnostics.push(`Prompt quality score ${scores.promptQualityScore} below threshold (55)`);
    }
    if (scores.compositionScore < 55) {
      diagnostics.push(`Composition score ${scores.compositionScore} below threshold (55)`);
    }
    if (scores.styleScore < 50) {
      diagnostics.push(`Style score ${scores.styleScore} below threshold (50)`);
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

    if (!record.promptAnalysis.subject || record.promptAnalysis.subject.length < 5) {
      diagnostics.push("Subject analysis incomplete");
    }
    if (!record.compositionPlan.composition || record.compositionPlan.composition.length < 10) {
      diagnostics.push("Composition plan incomplete");
    }
    if (!record.lightingPlan.studioLighting || record.lightingPlan.studioLighting.length < 5) {
      diagnostics.push("Lighting plan incomplete");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: TextToImageScores, record: TextToImageGenerationRecord): boolean {
    return (
      scores.productionReadinessScore >= 55 &&
      scores.promptQualityScore >= 55 &&
      scores.compositionScore >= 55 &&
      record.platformOptimizations.length >= 1 &&
      record.productionInstructions.renderNotes.length >= 1
    );
  }

  isBrandConsistent(context: GenerationContext, colorPlan: ColorPlan, stylePlan: StylePlan): boolean {
    if (!context.brandName) {
      return stylePlan.brandAlignment.length >= 10;
    }
    const brandLower = context.brandName.toLowerCase();
    return (
      stylePlan.brandAlignment.toLowerCase().includes(brandLower) ||
      colorPlan.brandColors.some((c) => c.toLowerCase().includes(brandLower)) ||
      colorPlan.brandColors.length >= 1
    );
  }

  private computePromptQuality(promptAnalysis: PromptAnalysis, context: GenerationContext): number {
    let score = 40;
    if (promptAnalysis.subject.length >= 10) score += 15;
    if (promptAnalysis.environment.length >= 10) score += 10;
    if (promptAnalysis.objects.length >= 1) score += 10;
    if (promptAnalysis.mood && promptAnalysis.emotion) score += 10;
    if (promptAnalysis.colorPalette.length >= 2) score += 10;
    if (context.textPrompt && context.textPrompt.length >= 20) score += 5;
    return Math.min(100, score);
  }

  private computeCompositionScore(compositionPlan: CompositionPlan): number {
    let score = 40;
    const fields = [
      compositionPlan.composition,
      compositionPlan.background,
      compositionPlan.foreground,
      compositionPlan.subjectPlacement,
      compositionPlan.cameraAngle,
      compositionPlan.perspective,
    ];
    score += Math.min(40, fields.filter((f) => f.length >= 10).length * 7);
    if (compositionPlan.objectPlacement.length >= 10) score += 10;
    if (compositionPlan.cameraDistance.length >= 5) score += 10;
    return Math.min(100, score);
  }

  private computeStyleScore(stylePlan: StylePlan, promptAnalysis: PromptAnalysis): number {
    let score = 45;
    if (stylePlan.styleNotes.length >= 15) score += 20;
    if (stylePlan.referenceStyles.length >= 1) score += 10;
    if (stylePlan.brandAlignment.length >= 10) score += 15;
    if (promptAnalysis.artisticStyle) score += 10;
    return Math.min(100, score);
  }

  private computeBrandConsistency(
    context: GenerationContext,
    colorPlan: ColorPlan,
    stylePlan: StylePlan
  ): number {
    let score = 45;
    if (colorPlan.brandColors.length >= 1) score += 20;
    if (colorPlan.primaryColors.length >= 2) score += 10;
    if (context.brandName && stylePlan.brandAlignment.toLowerCase().includes(context.brandName.toLowerCase())) {
      score += 15;
    }
    if (context.brandGuidelines) score += 10;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    compositionPlan: CompositionPlan,
    lightingPlan: LightingPlan,
    colorPlan: ColorPlan,
    platformOptimizations: PlatformImageOptimization[],
    variations: ImageVariation[]
  ): number {
    let score = 45;
    if (compositionPlan.composition && lightingPlan.hdrPreparation) score += 15;
    if (colorPlan.contrast && colorPlan.whiteBalance) score += 15;
    if (platformOptimizations.length >= 1) score += 15;
    if (variations.length >= 3) score += 10;
    return Math.min(100, score);
  }
}
