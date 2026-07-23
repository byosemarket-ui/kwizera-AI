import fs from "node:fs";
import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationModuleStatus } from "../video-generation-foundation/types.js";
import {
  deriveVideoGenerationPerformanceIssues,
  VideoGenerationResourceMetrics,
} from "./resource-monitor.js";
import {
  VideoGenerationHealthScoreLevel,
  VideoGenerationHealthWarning,
  VideoGenerationWarningType,
  MonitoredVideoGenerationModule,
  MonitoredVideoGenerationModuleHealthScore,
} from "./types.js";

export class VideoGenerationEarlyWarningSystem {
  constructor(private readonly foundation: AiVideoGenerationFoundation) {}

  async detect(
    moduleScores: MonitoredVideoGenerationModuleHealthScore[],
    metrics: VideoGenerationResourceMetrics
  ): Promise<VideoGenerationHealthWarning[]> {
    const warnings: VideoGenerationHealthWarning[] = [];
    const generationRoot = this.foundation.getGenerationRoot();

    const persistence = this.foundation.buildStatusReport();
    if (!persistence.persistenceStatus.includes("survives")) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.DatabaseProblems,
          MonitoredVideoGenerationModule.VideoGenerationFoundation,
          "Video generation database persistence unverified",
          "Run foundation integrity verification and recovery"
        )
      );
    }

    const registry = this.foundation.getRegistry();
    if (!registry.verifyChecksum()) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.RegistryProblems,
          MonitoredVideoGenerationModule.ProductionRegistry,
          "Video generation registry checksum invalid",
          "Re-persist registry and verify module registrations"
        )
      );
    }

    const integrity = this.foundation.getLastIntegrityResult();
    if (integrity && !integrity.verified) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.BrokenDependencies,
          MonitoredVideoGenerationModule.VideoGenerationFoundation,
          "Video generation integrity issues detected",
          "Run dependency validation and foundation recovery"
        )
      );
    }

    const storageChecks: {
      relativePath: string;
      module: MonitoredVideoGenerationModule;
      type: VideoGenerationWarningType;
      label: string;
      recommendation: string;
    }[] = [
      {
        relativePath: path.join("story", "engine", "story-generation-records.json"),
        module: MonitoredVideoGenerationModule.StoryboardGeneration,
        type: VideoGenerationWarningType.StoryboardProblems,
        label: "Storyboard generation records",
        recommendation: "Restore storyboard records from recovery point",
      },
      {
        relativePath: path.join("scenes", "engine", "scene-generation-records.json"),
        module: MonitoredVideoGenerationModule.SceneGeneration,
        type: VideoGenerationWarningType.SceneProblems,
        label: "Scene generation records",
        recommendation: "Restore scene generation records from recovery point",
      },
      {
        relativePath: path.join("camera-plans", "engine", "camera-director-records.json"),
        module: MonitoredVideoGenerationModule.CameraDirector,
        type: VideoGenerationWarningType.CameraProblems,
        label: "Camera director records",
        recommendation: "Review camera director records",
      },
      {
        relativePath: path.join("motion-plans", "engine", "motion-generation-records.json"),
        module: MonitoredVideoGenerationModule.MotionGeneration,
        type: VideoGenerationWarningType.MotionProblems,
        label: "Motion generation records",
        recommendation: "Review motion generation records",
      },
      {
        relativePath: path.join("production", "engine", "video-production-records.json"),
        module: MonitoredVideoGenerationModule.VideoProduction,
        type: VideoGenerationWarningType.ProductionProblems,
        label: "Video production records",
        recommendation: "Run production plan repair",
      },
      {
        relativePath: path.join("rendering", "engine", "rendering-preparation-records.json"),
        module: MonitoredVideoGenerationModule.RenderingPreparation,
        type: VideoGenerationWarningType.RenderPreparationProblems,
        label: "Rendering preparation records",
        recommendation: "Repair render preparation plans",
      },
      {
        relativePath: path.join("quality-validation", "engine", "quality-validation-records.json"),
        module: MonitoredVideoGenerationModule.VideoQualityValidation,
        type: VideoGenerationWarningType.ValidationProblems,
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

    const implemented = registry
      .getAllModules()
      .filter((m) => m.implemented && m.status === VideoGenerationModuleStatus.Active);
    const externalDeps = new Set([
      "video-generation-engine",
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
          VideoGenerationWarningType.BrokenDependencies,
          MonitoredVideoGenerationModule.VideoGenerationFoundation,
          `${missingDeps.length} broken dependency reference(s)`,
          "Validate module registration order and dependencies"
        )
      );
    }

    const storyReport = this.foundation.getStoryGenerationEngine().buildStatusReport();
    if (storyReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.StoryboardProblems,
          MonitoredVideoGenerationModule.StoryboardGeneration,
          storyReport.knownIssues.join("; "),
          "Review storyboard generation records"
        )
      );
    }

    const sceneReport = this.foundation.getSceneGenerationEngine().buildStatusReport();
    if (sceneReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.SceneProblems,
          MonitoredVideoGenerationModule.SceneGeneration,
          sceneReport.knownIssues.join("; "),
          "Review scene generation records"
        )
      );
    }

    const productionReport = this.foundation.getVideoProductionEngine().buildStatusReport();
    if (productionReport.knownIssues.length > 0) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.ProductionProblems,
          MonitoredVideoGenerationModule.VideoProduction,
          productionReport.knownIssues.join("; "),
          "Run video production plan repair"
        )
      );
    }

    if (metrics.searchPerformanceMs > 150) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.SearchFailure,
          MonitoredVideoGenerationModule.AssetRegistry,
          `Video generation search averaging ${metrics.searchPerformanceMs}ms`,
          "Run video generation optimization for search performance"
        )
      );
    }

    if (metrics.diskUsageMb > 3000) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.HighResourceUsage,
          MonitoredVideoGenerationModule.VideoGenerationFoundation,
          `${metrics.diskUsageMb}MB disk used by video generation`,
          "Archive inactive generation records"
        )
      );
    }

    if (metrics.memoryUsageMb > 400) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.HighResourceUsage,
          MonitoredVideoGenerationModule.AssetRegistry,
          `${metrics.memoryUsageMb}MB heap used`,
          "Optimize generation asset cache"
        )
      );
    }

    if (metrics.gpuUsagePercent > 80) {
      warnings.push(
        this.warn(
          VideoGenerationWarningType.HighResourceUsage,
          MonitoredVideoGenerationModule.VideoGenerationFoundation,
          `GPU usage at ${metrics.gpuUsagePercent}%`,
          "Reduce concurrent video generation workloads"
        )
      );
    }

    for (const issue of deriveVideoGenerationPerformanceIssues(metrics)) {
      if (!warnings.some((w) => w.message.includes(issue))) {
        warnings.push(
          this.warn(
            VideoGenerationWarningType.HighResourceUsage,
            MonitoredVideoGenerationModule.VideoGenerationFoundation,
            issue,
            "Monitor video generation performance trends"
          )
        );
      }
    }

    for (const mod of moduleScores) {
      if (
        mod.level === VideoGenerationHealthScoreLevel.Critical ||
        mod.level === VideoGenerationHealthScoreLevel.Failed
      ) {
        warnings.push(
          this.warn(
            VideoGenerationWarningType.ProductionProblems,
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
    type: VideoGenerationWarningType,
    module: MonitoredVideoGenerationModule,
    message: string,
    recommendation: string
  ): VideoGenerationHealthWarning {
    return {
      type,
      severity: VideoGenerationHealthScoreLevel.Warning,
      message,
      module,
      recommendation,
    };
  }
}
