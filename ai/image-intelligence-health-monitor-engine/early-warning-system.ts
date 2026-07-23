import fs from "node:fs";
import path from "node:path";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceModuleStatus } from "../image-intelligence-foundation/types.js";
import {
  deriveImageIntelligencePerformanceIssues,
  ImageIntelligenceResourceMetrics,
} from "./resource-monitor.js";
import {
  ImageIntelligenceHealthScoreLevel,
  ImageIntelligenceHealthWarning,
  ImageIntelligenceWarningType,
  MonitoredImageIntelligenceModule,
  MonitoredImageIntelligenceModuleHealthScore,
} from "./types.js";

const MODULE_ID_ALIASES: Record<string, string> = {
  "object-detection-intelligence-engine": "object-detection-intelligence",
  "background-intelligence-engine": "background-intelligence",
  "composition-intelligence-engine": "composition-intelligence",
  "lighting-color-intelligence-engine": "lighting-color-intelligence",
  "brand-visual-intelligence-engine": "brand-visual-intelligence",
  "image-enhancement-planning-engine": "image-enhancement-planning",
  "creative-image-intelligence-engine": "creative-image-intelligence",
  "production-image-planning-engine": "production-image-planning",
  "image-quality-prediction-engine": "image-quality-prediction",
  "image-intelligence-optimization-engine": "image-intelligence-optimization",
};

function resolveModuleId(dep: string): string {
  return MODULE_ID_ALIASES[dep] ?? dep;
}

export class ImageIntelligenceEarlyWarningSystem {
  constructor(private readonly foundation: AiImageIntelligenceFoundation) {}

  async detect(
    moduleScores: MonitoredImageIntelligenceModuleHealthScore[],
    metrics: ImageIntelligenceResourceMetrics
  ): Promise<ImageIntelligenceHealthWarning[]> {
    const warnings: ImageIntelligenceHealthWarning[] = [];

    const persistence = this.foundation.buildStatusReport();
    if (!persistence.persistenceStatus.includes("survives")) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.DatabaseProblems,
          MonitoredImageIntelligenceModule.ImageIntelligenceDatabase,
          "Image intelligence database persistence unverified",
          "Run foundation integrity verification and recovery"
        )
      );
    }

    const registry = this.foundation.getRegistry();
    if (!registry.verifyChecksum()) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.RegistryProblems,
          MonitoredImageIntelligenceModule.ImageIntelligenceRegistry,
          "Image intelligence registry checksum invalid",
          "Re-persist registry and verify module registrations"
        )
      );
    }

    const integrity = this.foundation.getLastIntegrityResult();
    if (integrity && !integrity.verified) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.BrokenDependencies,
          MonitoredImageIntelligenceModule.ImageIntelligenceFoundation,
          "Image intelligence integrity issues detected",
          "Run dependency validation and foundation recovery"
        )
      );
    }

    const intelligenceRoot = this.foundation.getIntelligenceRoot();
    const storageChecks: {
      relativePath: string;
      module: MonitoredImageIntelligenceModule;
      type: ImageIntelligenceWarningType;
      label: string;
      recommendation: string;
    }[] = [
      {
        relativePath: path.join("analysis", "engine", "image-analysis-records.json"),
        module: MonitoredImageIntelligenceModule.ImageAnalysis,
        type: ImageIntelligenceWarningType.InvalidImageMetadata,
        label: "Image analysis records",
        recommendation: "Restore image analysis records from recovery point",
      },
      {
        relativePath: path.join("understanding", "engine", "image-understanding-records.json"),
        module: MonitoredImageIntelligenceModule.ImageUnderstanding,
        type: ImageIntelligenceWarningType.RelationshipFailure,
        label: "Image understanding records",
        recommendation: "Repair image understanding records and relationships",
      },
      {
        relativePath: path.join("registry", "image-intelligence-registry.json"),
        module: MonitoredImageIntelligenceModule.ImageIntelligenceRegistry,
        type: ImageIntelligenceWarningType.RegistryProblems,
        label: "Image intelligence registry",
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
          this.warn(check.type, check.module, `${check.label} storage corrupted or invalid`, check.recommendation)
        );
      }
    }

    const implemented = registry
      .getAllModules()
      .filter((m) => m.implemented && m.status === ImageIntelligenceModuleStatus.Active);
    const missingDeps: string[] = [];
    const externalDeps = new Set([
      "image-engine",
      "product-engine",
      "knowledge-engine",
      "memory-engine",
      "product-intelligence-engine",
    ]);
    for (const mod of implemented) {
      for (const dep of mod.dependencies) {
        if (externalDeps.has(dep)) continue;
        const depMod = registry.getModule(resolveModuleId(dep));
        if (!depMod?.implemented) {
          missingDeps.push(`${mod.moduleId} missing ${dep}`);
        }
      }
    }
    if (missingDeps.length > 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.BrokenDependencies,
          MonitoredImageIntelligenceModule.ImageIntelligenceFoundation,
          `${missingDeps.length} broken dependency reference(s)`,
          "Validate module registration order and dependencies"
        )
      );
    }

    const objectReport = this.foundation.getObjectDetectionIntelligenceEngine().buildStatusReport();
    if (objectReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.ObjectDetectionProblems,
          MonitoredImageIntelligenceModule.ObjectDetection,
          objectReport.knownIssues.join("; "),
          "Review object detection records"
        )
      );
    }

    const backgroundReport = this.foundation.getBackgroundIntelligenceEngine().buildStatusReport();
    if (backgroundReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.BackgroundAnalysisProblems,
          MonitoredImageIntelligenceModule.BackgroundIntelligence,
          backgroundReport.knownIssues.join("; "),
          "Repair background intelligence analysis"
        )
      );
    }

    const compositionReport = this.foundation.getCompositionIntelligenceEngine().buildStatusReport();
    if (compositionReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.CompositionProblems,
          MonitoredImageIntelligenceModule.CompositionIntelligence,
          compositionReport.knownIssues.join("; "),
          "Review composition intelligence consistency"
        )
      );
    }

    const lightingReport = this.foundation.getLightingColorIntelligenceEngine().buildStatusReport();
    if (lightingReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.LightingProblems,
          MonitoredImageIntelligenceModule.LightingColorIntelligence,
          lightingReport.knownIssues.join("; "),
          "Review lighting and color intelligence"
        )
      );
    }

    const brandReport = this.foundation.getBrandVisualIntelligenceEngine().buildStatusReport();
    if (brandReport.averageConsistencyScore > 0 && brandReport.averageConsistencyScore < 55) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.BrandConsistencyProblems,
          MonitoredImageIntelligenceModule.BrandVisualIntelligence,
          `Brand consistency below threshold (${brandReport.averageConsistencyScore})`,
          "Re-analyze brand visual intelligence"
        )
      );
    }

    const creativeReport = this.foundation.getCreativeImageIntelligenceEngine().buildStatusReport();
    if (creativeReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.CreativePlanningProblems,
          MonitoredImageIntelligenceModule.CreativeImageIntelligence,
          creativeReport.knownIssues.join("; "),
          "Review creative image planning records"
        )
      );
    }

    const productionReport = this.foundation.getProductionImagePlanningEngine().buildStatusReport();
    if (productionReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.ProductionPlanningProblems,
          MonitoredImageIntelligenceModule.ProductionImagePlanning,
          productionReport.knownIssues.join("; "),
          "Run production image planning repair"
        )
      );
    }

    const analysisReport = this.foundation.getImageAnalysisEngine().buildStatusReport();
    if (analysisReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.ImageAnalysisFailure,
          MonitoredImageIntelligenceModule.ImageAnalysis,
          analysisReport.knownIssues.join("; "),
          "Re-analyze affected images"
        )
      );
    }

    if (metrics.searchPerformanceMs > 150) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.SearchFailure,
          MonitoredImageIntelligenceModule.ImageSearch,
          `Image search averaging ${metrics.searchPerformanceMs}ms`,
          "Run image intelligence optimization for search performance"
        )
      );
    }

    if (metrics.planningPerformanceMs > 120000) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.ProductionPlanningProblems,
          MonitoredImageIntelligenceModule.ProductionImagePlanning,
          `Planning pipeline averaging ${metrics.planningPerformanceMs}ms`,
          "Optimize production image planning workflow"
        )
      );
    }

    const cache = this.foundation.getImageIntelligenceOptimizationEngine().getCache();
    if (cache.hitRate < 5 && cache.images.length === 0) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.CacheProblems,
          MonitoredImageIntelligenceModule.ImageCache,
          "Image intelligence cache not warmed",
          "Run image intelligence optimization"
        )
      );
    }

    if (metrics.diskUsageMb > 3000) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.HighResourceUsage,
          MonitoredImageIntelligenceModule.ImageIntelligenceDatabase,
          `${metrics.diskUsageMb}MB disk used by image intelligence`,
          "Archive inactive image intelligence records"
        )
      );
    }

    if (metrics.memoryUsageMb > 400) {
      warnings.push(
        this.warn(
          ImageIntelligenceWarningType.HighResourceUsage,
          MonitoredImageIntelligenceModule.ImageCache,
          `${metrics.memoryUsageMb}MB heap used`,
          "Optimize image intelligence cache"
        )
      );
    }

    for (const issue of deriveImageIntelligencePerformanceIssues(metrics)) {
      if (!warnings.some((w) => w.message.includes(issue))) {
        warnings.push(
          this.warn(
            ImageIntelligenceWarningType.HighResourceUsage,
            MonitoredImageIntelligenceModule.ImageIntelligenceFoundation,
            issue,
            "Monitor image intelligence performance trends"
          )
        );
      }
    }

    for (const mod of moduleScores) {
      if (
        mod.level === ImageIntelligenceHealthScoreLevel.Critical ||
        mod.level === ImageIntelligenceHealthScoreLevel.Failed
      ) {
        warnings.push(
          this.warn(
            ImageIntelligenceWarningType.ImageAnalysisFailure,
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
    type: ImageIntelligenceWarningType,
    module: MonitoredImageIntelligenceModule,
    message: string,
    recommendation: string
  ): ImageIntelligenceHealthWarning {
    return {
      type,
      severity: ImageIntelligenceHealthScoreLevel.Warning,
      message,
      module,
      recommendation,
    };
  }
}
