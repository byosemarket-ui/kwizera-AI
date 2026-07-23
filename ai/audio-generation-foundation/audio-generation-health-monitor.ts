import fs from "node:fs";
import path from "node:path";
import { AudioGenerationHealthLevel, AudioGenerationHealthReport } from "./types.js";
import { PREPARED_AUDIO_GENERATION_MODULES } from "./audio-generation-categories.js";
import { GenerationAssetRegistry } from "./audio-generation-asset-registry.js";
import { AudioGenerationBlueprintManager } from "./audio-generation-blueprint-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { AudioGenerationAccessCoordinator } from "./audio-generation-access-coordinator.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationRegistry } from "./audio-generation-registry.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";

export class AudioGenerationHealthMonitor {
  constructor(private readonly logger: AudioGenerationFoundationLogger) {}

  async runHealthCheck(
    storage: AudioGenerationStorageManager,
    registry: AudioGenerationRegistry,
    access: AudioGenerationAccessCoordinator,
    assetRegistry: GenerationAssetRegistry,
    blueprintManager: AudioGenerationBlueprintManager,
    workflow: NonDestructiveGenerationWorkflow,
    integrationReady: boolean
  ): Promise<AudioGenerationHealthReport> {
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

    const report: AudioGenerationHealthReport = {
      level,
      score,
      availability: persistence.passed,
      storageIntegrity: checksumOk && persistence.passed,
      registryHealth: checksumOk && registry.getAllModules().length >= PREPARED_AUDIO_GENERATION_MODULES.length,
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

    this.logger.log("info", "health", "Audio Generation health check complete", {
      score,
      level,
      durationMs: Date.now() - start,
      issues: issues.length,
    });

    return report;
  }

  private scoreToLevel(score: number): AudioGenerationHealthLevel {
    if (score >= 95) return AudioGenerationHealthLevel.Excellent;
    if (score >= 80) return AudioGenerationHealthLevel.Good;
    if (score >= 60) return AudioGenerationHealthLevel.Warning;
    if (score >= 40) return AudioGenerationHealthLevel.Critical;
    return AudioGenerationHealthLevel.Failed;
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
