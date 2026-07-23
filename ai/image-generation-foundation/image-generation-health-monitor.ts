import fs from "node:fs";
import path from "node:path";
import { ImageGenerationHealthLevel, ImageGenerationHealthReport } from "./types.js";
import { PREPARED_IMAGE_GENERATION_MODULES } from "./image-generation-categories.js";
import { GenerationAssetRegistry } from "./generation-asset-registry.js";
import { ImageGenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { ImageGenerationAccessCoordinator } from "./image-generation-access-coordinator.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationRegistry } from "./image-generation-registry.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";

export class ImageGenerationHealthMonitor {
  constructor(private readonly logger: ImageGenerationFoundationLogger) {}

  async runHealthCheck(
    storage: ImageGenerationStorageManager,
    registry: ImageGenerationRegistry,
    access: ImageGenerationAccessCoordinator,
    assetRegistry: GenerationAssetRegistry,
    blueprintManager: ImageGenerationBlueprintManager,
    workflow: NonDestructiveGenerationWorkflow,
    integrationReady: boolean
  ): Promise<ImageGenerationHealthReport> {
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

    const report: ImageGenerationHealthReport = {
      level,
      score,
      availability: persistence.passed,
      storageIntegrity: checksumOk && persistence.passed,
      registryHealth: checksumOk && registry.getAllModules().length >= PREPARED_IMAGE_GENERATION_MODULES.length,
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

    this.logger.log("info", "health", "Image Generation health check complete", {
      score,
      level,
      durationMs: Date.now() - start,
      issues: issues.length,
    });

    return report;
  }

  private scoreToLevel(score: number): ImageGenerationHealthLevel {
    if (score >= 95) return ImageGenerationHealthLevel.Excellent;
    if (score >= 80) return ImageGenerationHealthLevel.Good;
    if (score >= 60) return ImageGenerationHealthLevel.Warning;
    if (score >= 40) return ImageGenerationHealthLevel.Critical;
    return ImageGenerationHealthLevel.Failed;
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
