import fs from "node:fs";
import path from "node:path";
import { VideoGenerationHealthLevel, VideoGenerationHealthReport } from "./types.js";
import { PREPARED_VIDEO_GENERATION_MODULES } from "./video-generation-categories.js";
import { GenerationAssetRegistry } from "./generation-asset-registry.js";
import { GenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { VideoGenerationAccessCoordinator } from "./video-generation-access-coordinator.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationRegistry } from "./video-generation-registry.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";

export class VideoGenerationHealthMonitor {
  constructor(private readonly logger: VideoGenerationFoundationLogger) {}

  async runHealthCheck(
    storage: VideoGenerationStorageManager,
    registry: VideoGenerationRegistry,
    access: VideoGenerationAccessCoordinator,
    assetRegistry: GenerationAssetRegistry,
    blueprintManager: GenerationBlueprintManager,
    workflow: NonDestructiveGenerationWorkflow,
    integrationReady: boolean
  ): Promise<VideoGenerationHealthReport> {
    const start = Date.now();
    const issues: string[] = [];

    const persistence = storage.verifyPersistence();
    if (!persistence.passed) issues.push(persistence.detail);

    const checksumOk = registry.verifyChecksum();
    if (!checksumOk) issues.push("Registry checksum invalid");

    const assetHealth = assetRegistry.verifyIntegrity();
    if (!assetHealth.valid) issues.push(...assetHealth.issues);

    const blueprintHealth = blueprintManager.verifyIntegrity();
    if (!blueprintHealth.valid) issues.push(...blueprintHealth.issues);

    const workflowHealth = workflow.verifyIntegrity();
    if (!workflowHealth.valid) issues.push(...workflowHealth.issues);

    if (!integrationReady) issues.push("Core integration not fully ready");

    const readMs = access.getAverageReadMs() || 1;
    const writeMs = access.getAverageWriteMs() || 1;

    let score = 100;
    if (!persistence.passed) score -= 25;
    if (!checksumOk) score -= 15;
    if (!assetHealth.valid) score -= 10;
    if (!blueprintHealth.valid) score -= 10;
    if (!workflowHealth.valid) score -= 5;
    if (!integrationReady) score -= 10;
    if (readMs > 100) score -= 5;
    score = Math.max(0, Math.min(100, score));

    const level = this.scoreToLevel(score);
    for (const mod of registry.getAllModules()) {
      registry.updateHealth(mod.moduleId, level);
    }

    const report: VideoGenerationHealthReport = {
      level,
      score,
      availability: persistence.passed,
      storageIntegrity: checksumOk && persistence.passed,
      registryHealth: checksumOk && registry.getAllModules().length >= PREPARED_VIDEO_GENERATION_MODULES.length,
      assetRegistryHealth: assetHealth.valid,
      blueprintHealth: blueprintHealth.valid,
      workflowHealth: workflowHealth.valid,
      qualityValidation: true,
      integrationReady,
      readPerformanceMs: readMs,
      writePerformanceMs: writeMs,
      issues,
      timestamp: new Date().toISOString(),
    };

    this.logger.log("info", "health", "Video Generation health check complete", {
      score,
      level,
      durationMs: Date.now() - start,
      issues: issues.length,
    });

    return report;
  }

  private scoreToLevel(score: number): VideoGenerationHealthLevel {
    if (score >= 95) return VideoGenerationHealthLevel.Excellent;
    if (score >= 80) return VideoGenerationHealthLevel.Good;
    if (score >= 60) return VideoGenerationHealthLevel.Warning;
    if (score >= 40) return VideoGenerationHealthLevel.Critical;
    return VideoGenerationHealthLevel.Failed;
  }

  verifyLogDirectory(logDir: string): boolean {
    return fs.existsSync(logDir);
  }

  verifyStorageWritable(generationRoot: string): boolean {
    try {
      const testFile = path.join(generationRoot, ".write-test");
      fs.writeFileSync(testFile, "ok", "utf8");
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }
}
