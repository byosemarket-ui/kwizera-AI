import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  MonitoredProductIntelligenceModule,
  MonitoredProductIntelligenceModuleHealthScore,
  ProductIntelligenceHealthScoreLevel,
} from "./types.js";

export class ProductIntelligenceModuleHealthChecker {
  constructor(private readonly foundation: AiProductIntelligenceFoundation) {}

  checkAll(): MonitoredProductIntelligenceModuleHealthScore[] {
    const scores: MonitoredProductIntelligenceModuleHealthScore[] = [];

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.ProductIntelligenceFoundation, () => {
        const r = this.foundation.buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.foundationStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.ProductAnalysis, () => {
        const r = this.foundation.getProductAnalysisEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.ProductUnderstanding, () => {
        const r = this.foundation.getProductUnderstandingEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.AudienceIntelligence, () => {
        const r = this.foundation.getTargetAudienceIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.MarketingStrategy, () => {
        const r = this.foundation.getMarketingStrategyIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.CreativeDirection, () => {
        const r = this.foundation.getCreativeDirectionEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.StoryboardIntelligence, () => {
        const r = this.foundation.getStoryboardIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.ScriptPlanning, () => {
        const r = this.foundation.getScriptPlanningEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.VisualPlanning, () => {
        const r = this.foundation.getVisualPlanningEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.AudioPlanning, () => {
        const r = this.foundation.getAudioPlanningEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.ProductionPlanning, () => {
        const r = this.foundation.getProductionPlanningEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.QualityPrediction, () => {
        const r = this.foundation.getQualityPredictionEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredProductIntelligenceModule.ProductIntelligenceOptimization, () => {
        const r = this.foundation.getProductIntelligenceOptimizationEngine().buildStatusReport();
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
      module: MonitoredProductIntelligenceModule.ProductIntelligenceRegistry,
      score: registry.verifyChecksum() ? 100 : 60,
      level: registry.verifyChecksum()
        ? ProductIntelligenceHealthScoreLevel.Excellent
        : ProductIntelligenceHealthScoreLevel.Warning,
      available: modules.length >= 12,
      issues: registry.verifyChecksum() ? [] : ["Registry checksum invalid"],
    });

    const persistence = this.foundation.buildStatusReport();
    scores.push({
      module: MonitoredProductIntelligenceModule.ProductIntelligenceDatabase,
      score: persistence.persistenceStatus.includes("survives") ? 100 : 55,
      level: this.scoreToLevel(persistence.persistenceStatus.includes("survives") ? 100 : 55),
      available: persistence.storageStatus.includes("verified"),
      issues: persistence.persistenceStatus.includes("survives") ? [] : ["Database persistence unverified"],
    });

    const qpReport = this.foundation.getQualityPredictionEngine().buildStatusReport();
    const relationshipScore = Math.min(
      100,
      70 + (qpReport.predictionsPrepared > 0 ? 15 : 0) + (qpReport.averageOverallQualityScore >= 55 ? 15 : 0)
    );
    scores.push({
      module: MonitoredProductIntelligenceModule.ProductRelationships,
      score: relationshipScore,
      level: this.scoreToLevel(relationshipScore),
      available: qpReport.engineStatus === "operational",
      issues: qpReport.predictionsPrepared === 0 ? ["No quality predictions to validate relationships"] : [],
    });

    const scriptPerf = this.foundation.getScriptPlanningEngine().buildStatusReport().performance;
    const analysisPerf = this.foundation.getProductAnalysisEngine().buildStatusReport().performance;
    const searchMs = Math.max(scriptPerf.averageSearchMs, analysisPerf.averageSearchMs);
    const searchScore = searchMs > 200 ? 50 : searchMs > 100 ? 70 : 95;
    scores.push({
      module: MonitoredProductIntelligenceModule.ProductSearch,
      score: searchScore,
      level: this.scoreToLevel(searchScore),
      available: true,
      issues: searchMs > 150 ? [`Search averaging ${searchMs}ms`] : [],
    });

    const cache = this.foundation.getProductIntelligenceOptimizationEngine().getCache();
    const cacheScore = Math.min(100, 60 + cache.hitRate / 2 + (cache.products.length > 0 ? 10 : 0));
    scores.push({
      module: MonitoredProductIntelligenceModule.ProductCache,
      score: cacheScore,
      level: this.scoreToLevel(cacheScore),
      available: true,
      issues: cache.hitRate < 5 ? ["Cache not warmed"] : [],
    });

    return scores;
  }

  scoreToLevel(score: number): ProductIntelligenceHealthScoreLevel {
    if (score >= 95) return ProductIntelligenceHealthScoreLevel.Excellent;
    if (score >= 80) return ProductIntelligenceHealthScoreLevel.Good;
    if (score >= 60) return ProductIntelligenceHealthScoreLevel.Warning;
    if (score >= 40) return ProductIntelligenceHealthScoreLevel.Critical;
    return ProductIntelligenceHealthScoreLevel.Failed;
  }

  private checkModule(
    module: MonitoredProductIntelligenceModule,
    fn: () => { score: number; available: boolean; issues: string[] }
  ): MonitoredProductIntelligenceModuleHealthScore {
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
