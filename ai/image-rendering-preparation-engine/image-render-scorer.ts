import {
  ImageRenderRecord,
  ImageRenderScores,
  LayerValidationEntry,
  MaskValidationEntry,
  OutputProfileEntry,
  RenderAssetValidationEntry,
  RenderSettingsPlan,
  RenderValidationEntry,
  ResourcePlanningPlan,
} from "./types.js";
import type { ImageRenderContext } from "./image-render-analyzer.js";

export class ImageRenderScorer {
  computeScores(
    renderValidation: RenderValidationEntry[],
    layerValidation: LayerValidationEntry[],
    maskValidation: MaskValidationEntry[],
    assetValidation: RenderAssetValidationEntry[],
    renderSettings: RenderSettingsPlan,
    outputProfiles: OutputProfileEntry[],
    resourcePlanning: ResourcePlanningPlan,
    context: ImageRenderContext
  ): ImageRenderScores {
    const workflowScore = this.computeRenderValidationScore(renderValidation);
    const layerIntegrityScore = this.computeLayerIntegrity(layerValidation);
    const maskIntegrityScore = this.computeMaskIntegrity(maskValidation);
    const assetQualityScore = this.computeAssetQuality(assetValidation, context);
    const platformCompatibilityScore = this.computePlatformCompatibility(outputProfiles, renderSettings);
    const performanceScore = this.computePerformanceScore(resourcePlanning, renderValidation);
    const renderReadinessScore = Math.round(
      (workflowScore + layerIntegrityScore + maskIntegrityScore + assetQualityScore + platformCompatibilityScore) / 5
    );
    const aiConfidenceScore = Math.round(
      (renderReadinessScore + layerIntegrityScore + maskIntegrityScore + assetQualityScore + performanceScore + platformCompatibilityScore) / 6
    );

    return {
      renderReadinessScore,
      assetQualityScore,
      layerIntegrityScore,
      maskIntegrityScore,
      performanceScore,
      platformCompatibilityScore,
      aiConfidenceScore,
    };
  }

  isRenderPlanValid(
    scores: ImageRenderScores,
    record: Pick<
      ImageRenderRecord,
      "renderValidation" | "layerValidation" | "maskValidation" | "assetValidation" | "renderSettings" | "resourcePlanning"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.renderReadinessScore < 55) diagnostics.push(`Render readiness score ${scores.renderReadinessScore} below threshold (55)`);
    if (scores.assetQualityScore < 55) diagnostics.push(`Asset quality score ${scores.assetQualityScore} below threshold (55)`);
    if (scores.layerIntegrityScore < 55) diagnostics.push(`Layer integrity score ${scores.layerIntegrityScore} below threshold (55)`);
    if (scores.maskIntegrityScore < 55) diagnostics.push(`Mask integrity score ${scores.maskIntegrityScore} below threshold (55)`);
    if (scores.platformCompatibilityScore < 55) diagnostics.push(`Platform compatibility score ${scores.platformCompatibilityScore} below threshold (55)`);
    if (scores.aiConfidenceScore < 55) diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);

    const failedValidation = record.renderValidation.filter((v) => !v.validated);
    if (failedValidation.length > 0) {
      diagnostics.push(`Render validation failed for: ${failedValidation.map((v) => v.stage).join(", ")}`);
    }

    const failedLayers = record.layerValidation.filter((l) => !l.validated);
    if (failedLayers.length > 0) {
      diagnostics.push(`Layer validation failed for: ${failedLayers.map((l) => l.check).join(", ")}`);
    }

    if (record.renderSettings.instructions.length < 2) {
      diagnostics.push("Render settings incomplete");
    }
    if (record.resourcePlanning.renderQueue.length < 1 && record.resourcePlanning.notes.length < 1) {
      diagnostics.push("Resource planning incomplete");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isRenderReady(scores: ImageRenderScores, record: ImageRenderRecord): boolean {
    return (
      scores.renderReadinessScore >= 55 &&
      scores.layerIntegrityScore >= 55 &&
      scores.maskIntegrityScore >= 55 &&
      record.renderValidation.every((v) => v.validated) &&
      record.layerValidation.every((l) => l.validated) &&
      record.renderSettings.instructions.length >= 2
    );
  }

  isProductionReady(context: ImageRenderContext): boolean {
    return Boolean(context.productionPlan?.productionReady);
  }

  private computeRenderValidationScore(renderValidation: RenderValidationEntry[]): number {
    const validated = renderValidation.filter((v) => v.validated).length;
    return Math.min(100, Math.round(45 + (validated / Math.max(renderValidation.length, 1)) * 55));
  }

  private computeLayerIntegrity(layerValidation: LayerValidationEntry[]): number {
    const validated = layerValidation.filter((l) => l.validated).length;
    return Math.min(100, Math.round(45 + (validated / Math.max(layerValidation.length, 1)) * 55));
  }

  private computeMaskIntegrity(maskValidation: MaskValidationEntry[]): number {
    const validated = maskValidation.filter((m) => m.validated).length;
    return Math.min(100, Math.round(45 + (validated / Math.max(maskValidation.length, 1)) * 55));
  }

  private computeAssetQuality(assetValidation: RenderAssetValidationEntry[], context: ImageRenderContext): number {
    const validated = assetValidation.filter((a) => a.validated).length;
    let score = Math.min(100, Math.round(40 + (validated / Math.max(assetValidation.length, 1)) * 45));
    if (context.productionPlan) score += 5;
    if (context.stylePlan) score += 5;
    return Math.min(100, score);
  }

  private computePlatformCompatibility(outputProfiles: OutputProfileEntry[], renderSettings: RenderSettingsPlan): number {
    let score = 45;
    if (outputProfiles.length >= 4) score += 25;
    if (outputProfiles.length >= 10) score += 15;
    if (renderSettings.resolution.length >= 7) score += 10;
    if (renderSettings.iccProfile.length >= 5) score += 5;
    return Math.min(100, score);
  }

  private computePerformanceScore(resourcePlanning: ResourcePlanningPlan, renderValidation: RenderValidationEntry[]): number {
    let score = 50;
    if (resourcePlanning.cpuAllocation.length >= 5) score += 10;
    if (resourcePlanning.gpuAllocation.length >= 5) score += 10;
    if (resourcePlanning.ramAllocation.length >= 5) score += 10;
    if (resourcePlanning.renderQueue.length >= 1) score += 10;
    if (renderValidation.every((v) => v.validated)) score += 10;
    return Math.min(100, score);
  }
}
