import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceHealthScoreLevel,
  MonitoredImageIntelligenceModule,
  MonitoredImageIntelligenceModuleHealthScore,
} from "./types.js";

export class ImageIntelligenceModuleHealthChecker {
  constructor(private readonly foundation: AiImageIntelligenceFoundation) {}

  checkAll(): MonitoredImageIntelligenceModuleHealthScore[] {
    const scores: MonitoredImageIntelligenceModuleHealthScore[] = [];

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.ImageIntelligenceFoundation, () => {
        const r = this.foundation.buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.foundationStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.ImageAnalysis, () => {
        const r = this.foundation.getImageAnalysisEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.ImageUnderstanding, () => {
        const r = this.foundation.getImageUnderstandingEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.ObjectDetection, () => {
        const r = this.foundation.getObjectDetectionIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.BackgroundIntelligence, () => {
        const r = this.foundation.getBackgroundIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.CompositionIntelligence, () => {
        const r = this.foundation.getCompositionIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.LightingColorIntelligence, () => {
        const r = this.foundation.getLightingColorIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.BrandVisualIntelligence, () => {
        const r = this.foundation.getBrandVisualIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.ImageEnhancementPlanning, () => {
        const r = this.foundation.getImageEnhancementPlanningEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.CreativeImageIntelligence, () => {
        const r = this.foundation.getCreativeImageIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.ProductionImagePlanning, () => {
        const r = this.foundation.getProductionImagePlanningEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.ImageQualityPrediction, () => {
        const r = this.foundation.getImageQualityPredictionEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredImageIntelligenceModule.ImageIntelligenceOptimization, () => {
        const r = this.foundation.getImageIntelligenceOptimizationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    const registry = this.foundation.getRegistry();
    const modules = registry.getAllModules();
    scores.push({
      module: MonitoredImageIntelligenceModule.ImageIntelligenceRegistry,
      score: registry.verifyChecksum() ? 100 : 60,
      level: registry.verifyChecksum()
        ? ImageIntelligenceHealthScoreLevel.Excellent
        : ImageIntelligenceHealthScoreLevel.Warning,
      available: modules.length >= 12,
      issues: registry.verifyChecksum() ? [] : ["Registry checksum invalid"],
    });

    const persistence = this.foundation.buildStatusReport();
    scores.push({
      module: MonitoredImageIntelligenceModule.ImageIntelligenceDatabase,
      score: persistence.persistenceStatus.includes("survives") ? 100 : 55,
      level: this.scoreToLevel(persistence.persistenceStatus.includes("survives") ? 100 : 55),
      available: persistence.storageStatus.includes("verified"),
      issues: persistence.persistenceStatus.includes("survives") ? [] : ["Database persistence unverified"],
    });

    const qpReport = this.foundation.getImageQualityPredictionEngine().buildStatusReport();
    const relationshipScore = Math.min(
      100,
      70 + (qpReport.predictionsCreated > 0 ? 15 : 0) + (qpReport.averageOverallQualityScore >= 55 ? 15 : 0)
    );
    scores.push({
      module: MonitoredImageIntelligenceModule.ImageRelationships,
      score: relationshipScore,
      level: this.scoreToLevel(relationshipScore),
      available: qpReport.engineStatus === "operational",
      issues: qpReport.predictionsCreated === 0 ? ["No quality predictions to validate relationships"] : [],
    });

    const analysisPerf = this.foundation.getImageAnalysisEngine().buildStatusReport().performance;
    const qpPerf = this.foundation.getImageQualityPredictionEngine().buildStatusReport().performance;
    const searchMs = Math.max(analysisPerf.averageSearchMs, qpPerf.averageSearchMs);
    const searchScore = searchMs > 200 ? 50 : searchMs > 100 ? 70 : 95;
    scores.push({
      module: MonitoredImageIntelligenceModule.ImageSearch,
      score: searchScore,
      level: this.scoreToLevel(searchScore),
      available: true,
      issues: searchMs > 150 ? [`Search averaging ${searchMs}ms`] : [],
    });

    const cache = this.foundation.getImageIntelligenceOptimizationEngine().getCache();
    const cacheScore = Math.min(100, 60 + cache.hitRate / 2 + (cache.images.length > 0 ? 10 : 0));
    scores.push({
      module: MonitoredImageIntelligenceModule.ImageCache,
      score: cacheScore,
      level: this.scoreToLevel(cacheScore),
      available: true,
      issues: cache.hitRate < 5 ? ["Cache not warmed"] : [],
    });

    return scores;
  }

  scoreToLevel(score: number): ImageIntelligenceHealthScoreLevel {
    if (score >= 95) return ImageIntelligenceHealthScoreLevel.Excellent;
    if (score >= 80) return ImageIntelligenceHealthScoreLevel.Good;
    if (score >= 60) return ImageIntelligenceHealthScoreLevel.Warning;
    if (score >= 40) return ImageIntelligenceHealthScoreLevel.Critical;
    return ImageIntelligenceHealthScoreLevel.Failed;
  }

  private checkModule(
    module: MonitoredImageIntelligenceModule,
    fn: () => { score: number; available: boolean; issues: string[] }
  ): MonitoredImageIntelligenceModuleHealthScore {
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
