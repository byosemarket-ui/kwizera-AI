import fs from "node:fs";
import path from "node:path";
import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationModuleStatus } from "../image-generation-foundation/types.js";
import {
  deriveImageGenerationPerformanceIssues,
  ImageGenerationResourceMetrics,
} from "./resource-monitor.js";
import {
  ImageGenerationHealthScoreLevel,
  ImageGenerationHealthWarning,
  ImageGenerationWarningType,
  MonitoredImageGenerationModule,
  MonitoredImageGenerationModuleHealthScore,
} from "./types.js";

export class ImageGenerationEarlyWarningSystem {
  constructor(private readonly foundation: AiImageGenerationFoundation) {}

  async detect(
    moduleScores: MonitoredImageGenerationModuleHealthScore[],
    metrics: ImageGenerationResourceMetrics
  ): Promise<ImageGenerationHealthWarning[]> {
    const warnings: ImageGenerationHealthWarning[] = [];
    const generationRoot = this.foundation.getGenerationRoot();

    const persistence = this.foundation.buildStatusReport();
    if (!persistence.persistenceStatus.includes("survives")) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.DatabaseProblems,
          MonitoredImageGenerationModule.ImageGenerationFoundation,
          "Image generation database persistence unverified",
          "Run foundation integrity verification and recovery"
        )
      );
    }

    const registry = this.foundation.getRegistry();
    if (!registry.verifyChecksum()) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.RegistryProblems,
          MonitoredImageGenerationModule.ProductionRegistry,
          "Image generation registry checksum invalid",
          "Re-persist registry and verify module registrations"
        )
      );
    }

    const integrity = this.foundation.getLastIntegrityResult();
    if (integrity && !integrity.verified) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.BrokenDependencies,
          MonitoredImageGenerationModule.ImageGenerationFoundation,
          "Image generation integrity issues detected",
          "Run dependency validation and foundation recovery"
        )
      );
    }

    const storageChecks: {
      relativePath: string;
      module: MonitoredImageGenerationModule;
      type: ImageGenerationWarningType;
      label: string;
      recommendation: string;
    }[] = [
      {
        relativePath: path.join("text-to-image", "engine", "text-to-image-generation-records.json"),
        module: MonitoredImageGenerationModule.TextToImageGeneration,
        type: ImageGenerationWarningType.PromptProblems,
        label: "Text-to-image prompt records",
        recommendation: "Restore prompt records from recovery point",
      },
      {
        relativePath: path.join("image-to-image", "engine", "image-to-image-generation-records.json"),
        module: MonitoredImageGenerationModule.ImageToImageGeneration,
        type: ImageGenerationWarningType.ImageProblems,
        label: "Image-to-image generation records",
        recommendation: "Restore image-to-image records from recovery point",
      },
      {
        relativePath: path.join("product-images", "engine", "product-image-generation-records.json"),
        module: MonitoredImageGenerationModule.ProductImageGeneration,
        type: ImageGenerationWarningType.ImageProblems,
        label: "Product image generation records",
        recommendation: "Restore product image records from recovery point",
      },
      {
        relativePath: path.join("backgrounds", "engine", "background-generation-records.json"),
        module: MonitoredImageGenerationModule.BackgroundGeneration,
        type: ImageGenerationWarningType.ImageProblems,
        label: "Background generation records",
        recommendation: "Review background generation records",
      },
      {
        relativePath: path.join("branding", "engine", "branding-design-records.json"),
        module: MonitoredImageGenerationModule.BrandingDesign,
        type: ImageGenerationWarningType.BrandingProblems,
        label: "Branding design records",
        recommendation: "Review branding design records",
      },
      {
        relativePath: path.join("production", "engine", "image-production-records.json"),
        module: MonitoredImageGenerationModule.ImageProduction,
        type: ImageGenerationWarningType.ProductionProblems,
        label: "Image production records",
        recommendation: "Run production plan repair",
      },
      {
        relativePath: path.join("rendering", "engine", "image-render-records.json"),
        module: MonitoredImageGenerationModule.ImageRenderingPreparation,
        type: ImageGenerationWarningType.RenderPreparationProblems,
        label: "Rendering preparation records",
        recommendation: "Repair render preparation plans",
      },
      {
        relativePath: path.join("quality-validation", "engine", "image-quality-validation-records.json"),
        module: MonitoredImageGenerationModule.ImageQualityValidation,
        type: ImageGenerationWarningType.ValidationProblems,
        label: "Quality validation records",
        recommendation: "Re-run quality validation",
      },
    ];

    for (const check of storageChecks) {
      const filePath = path.join(generationRoot, check.relativePath);
      if (!fs.existsSync(filePath)) continue;
      try {
        JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch {
        warnings.push(
          this.warn(check.type, check.module, `${check.label} storage corrupted or invalid`, check.recommendation)
        );
      }
    }

    const assetCatalog = path.join(generationRoot, "assets", "image-generation-asset-catalog.json");
    if (fs.existsSync(assetCatalog)) {
      try {
        JSON.parse(fs.readFileSync(assetCatalog, "utf8"));
      } catch {
        warnings.push(
          this.warn(
            ImageGenerationWarningType.RegistryProblems,
            MonitoredImageGenerationModule.AssetRegistry,
            "Asset registry catalog corrupted or invalid",
            "Repair asset registry from recovery point"
          )
        );
      }
    }

    const implemented = registry
      .getAllModules()
      .filter((m) => m.implemented && m.status === ImageGenerationModuleStatus.Active);
    const externalDeps = new Set([
      "image-generation-engine",
      "knowledge-engine",
      "memory-engine",
      "product-intelligence-engine",
      "image-intelligence-engine",
      "video-intelligence-engine",
    ]);
    const missingDeps: string[] = [];
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
          ImageGenerationWarningType.BrokenDependencies,
          MonitoredImageGenerationModule.ImageGenerationFoundation,
          `${missingDeps.length} broken dependency reference(s)`,
          "Validate module registration order and dependencies"
        )
      );
    }

    const promptReport = this.foundation.getTextToImageGenerationEngine().buildStatusReport();
    if (promptReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.PromptProblems,
          MonitoredImageGenerationModule.TextToImageGeneration,
          promptReport.knownIssues.join("; "),
          "Review text-to-image prompt records"
        )
      );
    }

    const productReport = this.foundation.getProductImageGenerationEngine().buildStatusReport();
    if (productReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.ImageProblems,
          MonitoredImageGenerationModule.ProductImageGeneration,
          productReport.knownIssues.join("; "),
          "Review product image generation records"
        )
      );
    }

    const renderReport = this.foundation.getImageRenderingPreparationEngine().buildStatusReport();
    if (renderReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.LayerProblems,
          MonitoredImageGenerationModule.ImageRenderingPreparation,
          renderReport.knownIssues.join("; "),
          "Review layer and mask integrity in render plans"
        )
      );
    }

    const productionReport = this.foundation.getImageProductionEngine().buildStatusReport();
    if (productionReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.ProductionProblems,
          MonitoredImageGenerationModule.ImageProduction,
          productionReport.knownIssues.join("; "),
          "Run image production plan repair"
        )
      );
    }

    const brandingReport = this.foundation.getBrandingDesignEngine().buildStatusReport();
    if (brandingReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.BrandingProblems,
          MonitoredImageGenerationModule.BrandingDesign,
          brandingReport.knownIssues.join("; "),
          "Review branding design consistency"
        )
      );
    }

    if (metrics.searchPerformanceMs > 150) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.SearchFailure,
          MonitoredImageGenerationModule.AssetRegistry,
          `Image generation search averaging ${metrics.searchPerformanceMs}ms`,
          "Run image generation optimization for search performance"
        )
      );
    }

    if (metrics.diskUsageMb > 3000) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.HighResourceUsage,
          MonitoredImageGenerationModule.ImageGenerationFoundation,
          `${metrics.diskUsageMb}MB disk used by image generation`,
          "Archive inactive generation records"
        )
      );
    }

    if (metrics.memoryUsageMb > 400) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.HighResourceUsage,
          MonitoredImageGenerationModule.AssetRegistry,
          `${metrics.memoryUsageMb}MB heap used`,
          "Optimize generation asset cache"
        )
      );
    }

    if (metrics.gpuUsagePercent > 80) {
      warnings.push(
        this.warn(
          ImageGenerationWarningType.HighResourceUsage,
          MonitoredImageGenerationModule.ImageGenerationFoundation,
          `GPU usage at ${metrics.gpuUsagePercent}%`,
          "Reduce concurrent image generation workloads"
        )
      );
    }

    for (const issue of deriveImageGenerationPerformanceIssues(metrics)) {
      if (!warnings.some((w) => w.message.includes(issue))) {
        warnings.push(
          this.warn(
            ImageGenerationWarningType.HighResourceUsage,
            MonitoredImageGenerationModule.ImageGenerationFoundation,
            issue,
            "Monitor image generation performance trends"
          )
        );
      }
    }

    for (const mod of moduleScores) {
      if (
        mod.level === ImageGenerationHealthScoreLevel.Critical ||
        mod.level === ImageGenerationHealthScoreLevel.Failed
      ) {
        warnings.push(
          this.warn(
            ImageGenerationWarningType.ProductionProblems,
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
    type: ImageGenerationWarningType,
    module: MonitoredImageGenerationModule,
    message: string,
    recommendation: string
  ): ImageGenerationHealthWarning {
    return {
      type,
      severity: ImageGenerationHealthScoreLevel.Warning,
      message,
      module,
      recommendation,
    };
  }
}
