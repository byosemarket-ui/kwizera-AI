import fs from "node:fs";
import path from "node:path";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceModuleStatus } from "../product-intelligence-foundation/types.js";
import {
  deriveProductIntelligencePerformanceIssues,
  ProductIntelligenceResourceMetrics,
} from "./resource-monitor.js";
import {
  MonitoredProductIntelligenceModule,
  MonitoredProductIntelligenceModuleHealthScore,
  ProductIntelligenceHealthScoreLevel,
  ProductIntelligenceHealthWarning,
  ProductIntelligenceWarningType,
} from "./types.js";

export class ProductIntelligenceEarlyWarningSystem {
  constructor(private readonly foundation: AiProductIntelligenceFoundation) {}

  async detect(
    moduleScores: MonitoredProductIntelligenceModuleHealthScore[],
    metrics: ProductIntelligenceResourceMetrics
  ): Promise<ProductIntelligenceHealthWarning[]> {
    const warnings: ProductIntelligenceHealthWarning[] = [];

    const persistence = this.foundation.buildStatusReport();
    if (!persistence.persistenceStatus.includes("survives")) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.DatabaseProblems,
          MonitoredProductIntelligenceModule.ProductIntelligenceDatabase,
          "Product intelligence database persistence unverified",
          "Run foundation integrity verification and recovery"
        )
      );
    }

    const registry = this.foundation.getRegistry();
    if (!registry.verifyChecksum()) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.RegistryProblems,
          MonitoredProductIntelligenceModule.ProductIntelligenceRegistry,
          "Product intelligence registry checksum invalid",
          "Re-persist registry and verify module registrations"
        )
      );
    }

    const integrity = this.foundation.getLastIntegrityResult();
    if (integrity && !integrity.verified) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.BrokenDependencies,
          MonitoredProductIntelligenceModule.ProductIntelligenceFoundation,
          "Product intelligence integrity issues detected",
          "Run dependency validation and foundation recovery"
        )
      );
    }

    const intelligenceRoot = this.foundation.getIntelligenceRoot();
    const storageChecks: {
      relativePath: string;
      module: MonitoredProductIntelligenceModule;
      type: ProductIntelligenceWarningType;
      label: string;
      recommendation: string;
    }[] = [
      {
        relativePath: path.join("analysis", "engine", "product-analysis-records.json"),
        module: MonitoredProductIntelligenceModule.ProductAnalysis,
        type: ProductIntelligenceWarningType.InvalidProductData,
        label: "Product analysis records",
        recommendation: "Restore product analysis records from recovery point",
      },
      {
        relativePath: path.join("script", "engine", "script-planning-records.json"),
        module: MonitoredProductIntelligenceModule.ScriptPlanning,
        type: ProductIntelligenceWarningType.ScriptProblems,
        label: "Script planning records",
        recommendation: "Repair script planning records and relationships",
      },
      {
        relativePath: path.join("registry", "product-intelligence-registry.json"),
        module: MonitoredProductIntelligenceModule.ProductIntelligenceRegistry,
        type: ProductIntelligenceWarningType.RegistryProblems,
        label: "Product intelligence registry",
        recommendation: "Re-persist registry from foundation recovery",
      },
    ];

    for (const check of storageChecks) {
      const filePath = path.join(intelligenceRoot, check.relativePath);
      if (!fs.existsSync(filePath)) continue;
      try {
        JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch {
        warnings.push(
          this.warn(
            check.type,
            check.module,
            `${check.label} storage corrupted or invalid`,
            check.recommendation
          )
        );
      }
    }

    const implemented = registry
      .getAllModules()
      .filter((m) => m.implemented && m.status === ProductIntelligenceModuleStatus.Active);
    const missingDeps: string[] = [];
    const externalDeps = new Set(["product-engine", "knowledge-engine", "memory-engine"]);
    for (const mod of implemented) {
      for (const dep of mod.dependencies) {
        if (externalDeps.has(dep)) continue;
        const depMod = registry.getModule(dep);
        if (!depMod?.implemented) {
          missingDeps.push(`${mod.moduleId} missing ${dep}`);
        }
      }
    }
    if (missingDeps.length > 0) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.BrokenDependencies,
          MonitoredProductIntelligenceModule.ProductIntelligenceFoundation,
          `${missingDeps.length} broken dependency reference(s)`,
          "Validate module registration order and dependencies"
        )
      );
    }

    const storyboardReport = this.foundation.getStoryboardIntelligenceEngine().buildStatusReport();
    if (storyboardReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.StoryboardProblems,
          MonitoredProductIntelligenceModule.StoryboardIntelligence,
          storyboardReport.knownIssues.join("; "),
          "Review storyboard planning records"
        )
      );
    }

    const scriptReport = this.foundation.getScriptPlanningEngine().buildStatusReport();
    if (scriptReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.ScriptProblems,
          MonitoredProductIntelligenceModule.ScriptPlanning,
          scriptReport.knownIssues.join("; "),
          "Repair script planning records"
        )
      );
    }

    const visualReport = this.foundation.getVisualPlanningEngine().buildStatusReport();
    if (visualReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.VisualPlanningProblems,
          MonitoredProductIntelligenceModule.VisualPlanning,
          visualReport.knownIssues.join("; "),
          "Review visual planning consistency"
        )
      );
    }

    const audioReport = this.foundation.getAudioPlanningEngine().buildStatusReport();
    if (audioReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.AudioPlanningProblems,
          MonitoredProductIntelligenceModule.AudioPlanning,
          audioReport.knownIssues.join("; "),
          "Review audio planning records"
        )
      );
    }

    const productionReport = this.foundation.getProductionPlanningEngine().buildStatusReport();
    if (productionReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.ProductionPlanningProblems,
          MonitoredProductIntelligenceModule.ProductionPlanning,
          productionReport.knownIssues.join("; "),
          "Run production planning repair"
        )
      );
    }

    const audienceReport = this.foundation.getTargetAudienceIntelligenceEngine().buildStatusReport();
    if (audienceReport.averageRelevanceScore > 0 && audienceReport.averageRelevanceScore < 55) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.AudienceMismatch,
          MonitoredProductIntelligenceModule.AudienceIntelligence,
          `Low audience relevance score (${audienceReport.averageRelevanceScore})`,
          "Re-analyze target audience alignment"
        )
      );
    }

    const strategyReport = this.foundation.getMarketingStrategyIntelligenceEngine().buildStatusReport();
    if (strategyReport.averageStrategyQualityScore > 0 && strategyReport.averageStrategyQualityScore < 55) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.MarketingMisalignment,
          MonitoredProductIntelligenceModule.MarketingStrategy,
          `Low marketing strategy quality (${strategyReport.averageStrategyQualityScore})`,
          "Refresh marketing strategy intelligence"
        )
      );
    }

    const creativeReport = this.foundation.getCreativeDirectionEngine().buildStatusReport();
    if (creativeReport.averageCreativeQualityScore > 0 && creativeReport.averageCreativeQualityScore < 55) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.CreativeInconsistency,
          MonitoredProductIntelligenceModule.CreativeDirection,
          `Creative direction quality below threshold (${creativeReport.averageCreativeQualityScore})`,
          "Re-plan creative direction for consistency"
        )
      );
    }

    if (metrics.searchPerformanceMs > 150) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.SearchFailure,
          MonitoredProductIntelligenceModule.ProductSearch,
          `Product search averaging ${metrics.searchPerformanceMs}ms`,
          "Run product intelligence optimization for search performance"
        )
      );
    }

    if (metrics.planningPerformanceMs > 120000) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.PlanningFailure,
          MonitoredProductIntelligenceModule.ProductionPlanning,
          `Planning pipeline averaging ${metrics.planningPerformanceMs}ms`,
          "Optimize production planning workflow"
        )
      );
    }

    const cache = this.foundation.getProductIntelligenceOptimizationEngine().getCache();
    if (cache.hitRate < 5 && cache.products.length === 0) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.CacheProblems,
          MonitoredProductIntelligenceModule.ProductCache,
          "Product intelligence cache not warmed",
          "Run product intelligence optimization"
        )
      );
    }

    if (metrics.diskUsageMb > 3000) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.HighResourceUsage,
          MonitoredProductIntelligenceModule.ProductIntelligenceDatabase,
          `${metrics.diskUsageMb}MB disk used by product intelligence`,
          "Archive inactive product intelligence records"
        )
      );
    }

    if (metrics.memoryUsageMb > 400) {
      warnings.push(
        this.warn(
          ProductIntelligenceWarningType.HighResourceUsage,
          MonitoredProductIntelligenceModule.ProductCache,
          `${metrics.memoryUsageMb}MB heap used`,
          "Optimize product intelligence cache"
        )
      );
    }

    for (const issue of deriveProductIntelligencePerformanceIssues(metrics)) {
      if (!warnings.some((w) => w.message.includes(issue))) {
        warnings.push(
          this.warn(
            ProductIntelligenceWarningType.HighResourceUsage,
            MonitoredProductIntelligenceModule.ProductIntelligenceFoundation,
            issue,
            "Monitor product intelligence performance trends"
          )
        );
      }
    }

    for (const mod of moduleScores) {
      if (
        mod.level === ProductIntelligenceHealthScoreLevel.Critical ||
        mod.level === ProductIntelligenceHealthScoreLevel.Failed
      ) {
        warnings.push(
          this.warn(
            ProductIntelligenceWarningType.PlanningFailure,
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
    type: ProductIntelligenceWarningType,
    module: MonitoredProductIntelligenceModule,
    message: string,
    recommendation: string
  ): ProductIntelligenceHealthWarning {
    return {
      type,
      severity: ProductIntelligenceHealthScoreLevel.Warning,
      message,
      module,
      recommendation,
    };
  }
}
