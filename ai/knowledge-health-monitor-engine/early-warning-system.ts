import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  deriveKnowledgePerformanceIssues,
  KnowledgeResourceMetrics,
} from "./resource-monitor.js";
import {
  KnowledgeHealthScoreLevel,
  KnowledgeHealthWarning,
  KnowledgeWarningType,
  MonitoredKnowledgeModule,
  MonitoredKnowledgeModuleHealthScore,
} from "./types.js";

export class KnowledgeEarlyWarningSystem {
  constructor(private readonly foundation: AiKnowledgeFoundation) {}

  async detect(
    moduleScores: MonitoredKnowledgeModuleHealthScore[],
    metrics: KnowledgeResourceMetrics
  ): Promise<KnowledgeHealthWarning[]> {
    const warnings: KnowledgeHealthWarning[] = [];

    try {
      const storageIntegrity = this.foundation.getStorageEngine().runIntegrityCheck();
      if (!storageIntegrity.verified) {
        warnings.push(
          this.warn(
            KnowledgeWarningType.KnowledgeCorruption,
            MonitoredKnowledgeModule.StorageEngine,
            "Knowledge storage integrity issues detected",
            "Run knowledge validation and integrity repair"
          )
        );
      }
    } catch {
      warnings.push(
        this.warn(
          KnowledgeWarningType.KnowledgeCorruption,
          MonitoredKnowledgeModule.StorageEngine,
          "Knowledge storage integrity check failed",
          "Inspect corrupted knowledge records"
        )
      );
    }

    const graphIntegrity = this.foundation.getGraphEngine().validateIntegrity();
    if (!graphIntegrity.valid) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.GraphProblems,
          MonitoredKnowledgeModule.GraphEngine,
          "Knowledge graph integrity issues detected",
          "Run graph integrity repair"
        )
      );
    }

    const relationships = await this.foundation
      .getKnowledgeValidationEngine()
      .validateRelationships(false);
    if (!relationships.valid || relationships.brokenReferences > 0) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.BrokenRelationships,
          MonitoredKnowledgeModule.KnowledgeRelationships,
          `${relationships.brokenReferences} broken relationship reference(s)`,
          "Run relationship validation with repair"
        )
      );
    }

    const consistency = await this.foundation
      .getKnowledgeValidationEngine()
      .validateConsistency(false);
    if (consistency.duplicateGroups > 0) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.DuplicateKnowledge,
          MonitoredKnowledgeModule.OptimizationEngine,
          `${consistency.duplicateGroups} duplicate knowledge group(s)`,
          "Run knowledge deduplication"
        )
      );
    }
    if (consistency.orphanRecords > 0 || consistency.invalidReferences > 0) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.IncompleteKnowledge,
          MonitoredKnowledgeModule.ValidationEngine,
          "Incomplete or orphan knowledge detected",
          "Run knowledge quality improvement"
        )
      );
    }

    const analysis = await this.foundation
      .getKnowledgeOptimizationEngine()
      .analyzeKnowledge()
      .catch(() => ({
        totalRecords: 0,
        incompleteRecords: 1,
        lowQualityRecords: 1,
        duplicateGroups: 0,
        fragmentationScore: 0,
        indexQualityScore: 75,
        relationshipQualityScore: 75,
        graphQualityScore: 75,
        classificationQualityScore: 75,
        averageSearchMs: 0,
        averageRetrievalMs: 0,
        averageRecommendationMs: 0,
        tierDistribution: {} as never,
        knowledgeGrowthRate: 0,
        totalStorageBytes: 0,
        durationMs: 0,
      }));
    if (analysis.incompleteRecords > 0) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.IncompleteKnowledge,
          MonitoredKnowledgeModule.ValidationEngine,
          `${analysis.incompleteRecords} incomplete record(s)`,
          "Complete missing summaries and metadata"
        )
      );
    }
    if (analysis.lowQualityRecords > 0) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.ValidationFailure,
          MonitoredKnowledgeModule.ValidationEngine,
          `${analysis.lowQualityRecords} low-quality record(s)`,
          "Run knowledge validation batch"
        )
      );
    }

    if (metrics.retrievalPerformanceMs > 150) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.SlowRetrieval,
          MonitoredKnowledgeModule.RetrievalEngine,
          `Retrieval averaging ${metrics.retrievalPerformanceMs}ms`,
          "Run knowledge cache optimization"
        )
      );
    }

    if (metrics.searchPerformanceMs > 150) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.SlowSearch,
          MonitoredKnowledgeModule.KnowledgeSearch,
          `Search averaging ${metrics.searchPerformanceMs}ms`,
          "Run knowledge optimization"
        )
      );
    }

    if (metrics.diskUsageMb > 3000) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.HighDiskUsage,
          MonitoredKnowledgeModule.KnowledgeStorage,
          `${metrics.diskUsageMb}MB disk used by knowledge`,
          "Archive inactive knowledge"
        )
      );
    }

    if (metrics.memoryUsageMb > 400) {
      warnings.push(
        this.warn(
          KnowledgeWarningType.HighMemoryUsage,
          MonitoredKnowledgeModule.KnowledgeCache,
          `${metrics.memoryUsageMb}MB heap used`,
          "Optimize knowledge cache"
        )
      );
    }

    for (const issue of deriveKnowledgePerformanceIssues(metrics)) {
      if (!warnings.some((w) => w.message.includes(issue))) {
        warnings.push(
          this.warn(
            KnowledgeWarningType.SlowSearch,
            MonitoredKnowledgeModule.KnowledgeSearch,
            issue,
            "Monitor knowledge performance trends"
          )
        );
      }
    }

    for (const mod of moduleScores) {
      if (
        mod.level === KnowledgeHealthScoreLevel.Critical ||
        mod.level === KnowledgeHealthScoreLevel.Failed
      ) {
        warnings.push(
          this.warn(
            KnowledgeWarningType.StorageProblems,
            mod.module,
            `${mod.module} health critical (${mod.score})`,
            `Inspect ${mod.module} diagnostics`
          )
        );
      }
    }

    return warnings;
  }

  private warn(
    type: KnowledgeWarningType,
    module: MonitoredKnowledgeModule,
    message: string,
    recommendation: string
  ): KnowledgeHealthWarning {
    return { type, severity: KnowledgeHealthScoreLevel.Warning, message, module, recommendation };
  }
}
