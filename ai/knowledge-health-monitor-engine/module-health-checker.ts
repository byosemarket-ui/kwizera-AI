import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeHealthScoreLevel,
  MonitoredKnowledgeModule,
  MonitoredKnowledgeModuleHealthScore,
} from "./types.js";

export class KnowledgeModuleHealthChecker {
  constructor(private readonly foundation: AiKnowledgeFoundation) {}

  checkAll(): MonitoredKnowledgeModuleHealthScore[] {
    const scores: MonitoredKnowledgeModuleHealthScore[] = [];

    scores.push(this.checkModule(MonitoredKnowledgeModule.KnowledgeFoundation, () => {
      const r = this.foundation.buildStatusReport();
      return {
        score: r.readinessScore,
        available: r.foundationStatus === "operational",
        issues: r.knownIssues,
      };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.StorageEngine, () => {
      const r = this.foundation.getStorageEngine().buildStatusReport();
      return {
        score: r.readinessScore,
        available: r.storageStatus === "available",
        issues: r.knownIssues,
      };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.RetrievalEngine, () => {
      const r = this.foundation.getRetrievalEngine().buildStatusReport();
      return {
        score: r.readinessScore,
        available: r.engineStatus === "operational",
        issues: r.knownIssues,
      };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.GraphEngine, () => {
      const r = this.foundation.getGraphEngine().buildStatusReport();
      return {
        score: r.readinessScore,
        available: r.engineStatus === "operational",
        issues: r.knownIssues,
      };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.ImageKnowledge, () => {
      const r = this.foundation.getImageKnowledgeEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.VideoKnowledge, () => {
      const r = this.foundation.getVideoKnowledgeEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.MarketingKnowledge, () => {
      const r = this.foundation.getMarketingKnowledgeEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.ProductKnowledge, () => {
      const r = this.foundation.getProductKnowledgeEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.BrandKnowledge, () => {
      const r = this.foundation.getBrandKnowledgeEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.LanguageKnowledge, () => {
      const r = this.foundation.getLanguageKnowledgeEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.CreativeKnowledge, () => {
      const r = this.foundation.getCreativeKnowledgeEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.OptimizationEngine, () => {
      const r = this.foundation.getKnowledgeOptimizationEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    scores.push(this.checkModule(MonitoredKnowledgeModule.ValidationEngine, () => {
      const r = this.foundation.getKnowledgeValidationEngine().buildStatusReport();
      return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
    }));

    const registry = this.foundation.getRegistry();
    const modules = registry.getAllModules();
    scores.push({
      module: MonitoredKnowledgeModule.KnowledgeRegistry,
      score: registry.verifyChecksum() ? 100 : 60,
      level: registry.verifyChecksum() ? KnowledgeHealthScoreLevel.Excellent : KnowledgeHealthScoreLevel.Warning,
      available: modules.length >= 12,
      issues: registry.verifyChecksum() ? [] : ["Registry checksum invalid"],
    });

    const retrieval = this.foundation.getRetrievalEngine().buildStatusReport();
    scores.push({
      module: MonitoredKnowledgeModule.KnowledgeCache,
      score: Math.min(100, 70 + retrieval.cacheStatus.hitRate / 5),
      level: KnowledgeHealthScoreLevel.Good,
      available: true,
      issues: [],
    });

    scores.push({
      module: MonitoredKnowledgeModule.KnowledgeSearch,
      score: retrieval.readinessScore,
      level: this.scoreToLevel(retrieval.readinessScore),
      available: retrieval.engineStatus === "operational",
      issues: retrieval.knownIssues,
    });

    const graph = this.foundation.getGraphEngine().buildStatusReport();
    scores.push({
      module: MonitoredKnowledgeModule.KnowledgeRelationships,
      score: graph.readinessScore,
      level: this.scoreToLevel(graph.readinessScore),
      available: graph.engineStatus === "operational",
      issues: graph.knownIssues,
    });

    scores.push({
      module: MonitoredKnowledgeModule.KnowledgeDatabase,
      score: this.foundation.getStorageEngine().getRecordCount() >= 0 ? 100 : 50,
      level: KnowledgeHealthScoreLevel.Excellent,
      available: this.foundation.getStorageEngine().isStorageAvailable(),
      issues: [],
    });

    scores.push({
      module: MonitoredKnowledgeModule.KnowledgeStorage,
      score: this.foundation.getStorageEngine().buildStatusReport().readinessScore,
      level: this.scoreToLevel(this.foundation.getStorageEngine().buildStatusReport().readinessScore),
      available: this.foundation.getStorageEngine().isStorageAvailable(),
      issues: [],
    });

    return scores;
  }

  scoreToLevel(score: number): KnowledgeHealthScoreLevel {
    if (score >= 95) return KnowledgeHealthScoreLevel.Excellent;
    if (score >= 80) return KnowledgeHealthScoreLevel.Good;
    if (score >= 60) return KnowledgeHealthScoreLevel.Warning;
    if (score >= 40) return KnowledgeHealthScoreLevel.Critical;
    return KnowledgeHealthScoreLevel.Failed;
  }

  private checkModule(
    module: MonitoredKnowledgeModule,
    fn: () => { score: number; available: boolean; issues: string[] }
  ): MonitoredKnowledgeModuleHealthScore {
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
