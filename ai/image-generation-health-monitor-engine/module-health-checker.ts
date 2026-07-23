import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationHealthScoreLevel,
  MonitoredImageGenerationModule,
  MonitoredImageGenerationModuleHealthScore,
} from "./types.js";

export class ImageGenerationModuleHealthChecker {
  constructor(private readonly foundation: AiImageGenerationFoundation) {}

  checkAll(): MonitoredImageGenerationModuleHealthScore[] {
    const scores: MonitoredImageGenerationModuleHealthScore[] = [];

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ImageGenerationFoundation, () => {
        const r = this.foundation.buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.foundationStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.TextToImageGeneration, () => {
        const r = this.foundation.getTextToImageGenerationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ImageToImageGeneration, () => {
        const r = this.foundation.getImageToImageGenerationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ProductImageGeneration, () => {
        const r = this.foundation.getProductImageGenerationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.BackgroundGeneration, () => {
        const r = this.foundation.getBackgroundGenerationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ImageEditing, () => {
        const r = this.foundation.getImageEditingEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ImageEnhancement, () => {
        const r = this.foundation.getImageEnhancementEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.BrandingDesign, () => {
        const r = this.foundation.getBrandingDesignEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.MultiStyleImageGeneration, () => {
        const r = this.foundation.getMultiStyleImageGenerationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ImageProduction, () => {
        const r = this.foundation.getImageProductionEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ImageRenderingPreparation, () => {
        const r = this.foundation.getImageRenderingPreparationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ImageQualityValidation, () => {
        const r = this.foundation.getImageQualityValidationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageGenerationModule.ImageGenerationOptimization, () => {
        const r = this.foundation.getImageGenerationOptimizationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    const assetHealth = this.foundation.getAssetRegistry().verifyIntegrity();
    scores.push({
      module: MonitoredImageGenerationModule.AssetRegistry,
      score: assetHealth.valid ? 100 : 55,
      level: this.scoreToLevel(assetHealth.valid ? 100 : 55),
      available: this.foundation.getAssetRegistry().getCount() >= 0,
      issues: assetHealth.issues,
    });

    const promptReport = this.foundation.getTextToImageGenerationEngine().buildStatusReport();
    scores.push({
      module: MonitoredImageGenerationModule.PromptRegistry,
      score: promptReport.imagePlansGenerated > 0 ? promptReport.readinessScore : 85,
      level: this.scoreToLevel(promptReport.imagePlansGenerated > 0 ? promptReport.readinessScore : 85),
      available: promptReport.engineStatus === "operational",
      issues: promptReport.knownIssues,
    });

    const renderReport = this.foundation.getImageRenderingPreparationEngine().buildStatusReport();
    const layerScore =
      renderReport.averageLayerIntegrityScore > 0 ? renderReport.averageLayerIntegrityScore : 85;
    scores.push({
      module: MonitoredImageGenerationModule.LayerRegistry,
      score: layerScore,
      level: this.scoreToLevel(layerScore),
      available: renderReport.engineStatus === "operational",
      issues: renderReport.knownIssues,
    });

    const renderRecords = this.foundation.getImageRenderingPreparationEngine().buildStatusReport();
    const maskScore =
      renderRecords.averageLayerIntegrityScore > 0 ? renderRecords.averageLayerIntegrityScore : 85;
    scores.push({
      module: MonitoredImageGenerationModule.MaskRegistry,
      score: maskScore,
      level: this.scoreToLevel(maskScore),
      available: renderRecords.engineStatus === "operational",
      issues: renderRecords.knownIssues,
    });

    const registry = this.foundation.getRegistry();
    scores.push({
      module: MonitoredImageGenerationModule.ProductionRegistry,
      score: registry.verifyChecksum() ? 100 : 60,
      level: registry.verifyChecksum()
        ? ImageGenerationHealthScoreLevel.Excellent
        : ImageGenerationHealthScoreLevel.Warning,
      available: registry.getAllModules().length >= 12,
      issues: registry.verifyChecksum() ? [] : ["Production registry checksum invalid"],
    });

    return scores;
  }

  scoreToLevel(score: number): ImageGenerationHealthScoreLevel {
    if (score >= 95) return ImageGenerationHealthScoreLevel.Excellent;
    if (score >= 80) return ImageGenerationHealthScoreLevel.Good;
    if (score >= 60) return ImageGenerationHealthScoreLevel.Warning;
    if (score >= 40) return ImageGenerationHealthScoreLevel.Critical;
    return ImageGenerationHealthScoreLevel.Failed;
  }

  private checkModule(
    module: MonitoredImageGenerationModule,
    fn: () => { score: number; available: boolean; issues: string[] }
  ): MonitoredImageGenerationModuleHealthScore {
    const result = fn();
    return {
      module,
      score: result.score,
      level: this.scoreToLevel(result.score),
      available: result.available,
      issues: result.issues,
    };
  }
}
