import fs from "node:fs";
import path from "node:path";
import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceHealthReport,
  ImageIntelligenceModuleRegistration,
} from "./types.js";
import { PREPARED_IMAGE_INTELLIGENCE_MODULES } from "./image-intelligence-categories.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceAccessCoordinator } from "./image-intelligence-access-coordinator.js";
import { ImageIntelligenceRegistry } from "./image-intelligence-registry.js";
import { ImageIntelligenceStorageManager } from "./image-intelligence-storage.js";

export class ImageIntelligenceHealthMonitor {
  private lastReport: ImageIntelligenceHealthReport | null = null;

  constructor(private readonly logger: ImageIntelligenceFoundationLogger) {}

  async runHealthCheck(
    storage: ImageIntelligenceStorageManager,
    registry: ImageIntelligenceRegistry,
    access: ImageIntelligenceAccessCoordinator,
    integrationReady: boolean
  ): Promise<ImageIntelligenceHealthReport> {
    const start = Date.now();
    const issues: string[] = [];

    const persistence = storage.verifyPersistence();
    if (!persistence.passed) {
      issues.push(persistence.detail);
    }

    const checksumOk = registry.verifyChecksum();
    if (!checksumOk) {
      issues.push("Registry checksum invalid");
    }

    const modules = registry.getAllModules();
    const failedModules = modules.filter(
      (m) =>
        m.healthStatus === ImageIntelligenceHealthLevel.Critical ||
        m.healthStatus === ImageIntelligenceHealthLevel.Failed
    );
    if (failedModules.length > 0) {
      issues.push(`${failedModules.length} module(s) in critical/failed health`);
    }

    if (!integrationReady) {
      issues.push("Core integration not fully ready");
    }

    const readMs = access.getAverageReadMs() || 1;
    const writeMs = access.getAverageWriteMs() || 1;

    let score = 100;
    if (!persistence.passed) score -= 30;
    if (!checksumOk) score -= 20;
    if (failedModules.length > 0) score -= 15;
    if (!integrationReady) score -= 10;
    if (readMs > 100) score -= 5;
    if (writeMs > 100) score -= 5;
    score = Math.max(0, Math.min(100, score));

    const level = this.scoreToLevel(score);
    for (const mod of modules) {
      registry.updateHealth(mod.moduleId, level);
    }

    const report: ImageIntelligenceHealthReport = {
      level,
      score,
      availability: persistence.passed,
      storageIntegrity: checksumOk && persistence.passed,
      registryHealth: checksumOk && modules.length >= PREPARED_IMAGE_INTELLIGENCE_MODULES.length,
      qualityValidation: true,
      integrationReady,
      readPerformanceMs: readMs,
      writePerformanceMs: writeMs,
      issues,
      timestamp: new Date().toISOString(),
    };

    this.lastReport = report;
    const durationMs = Date.now() - start;

    this.logger.log("info", "health", "Image Intelligence health check complete", {
      score,
      level,
      durationMs,
      issues: issues.length,
    });

    return report;
  }

  getLastReport(): ImageIntelligenceHealthReport | null {
    return this.lastReport;
  }

  verifyRegistryHealth(modules: ImageIntelligenceModuleRegistration[]): boolean {
    return (
      modules.length >= PREPARED_IMAGE_INTELLIGENCE_MODULES.length &&
      modules.every((m) => m.storageLocation.length > 0)
    );
  }

  private scoreToLevel(score: number): ImageIntelligenceHealthLevel {
    if (score >= 95) return ImageIntelligenceHealthLevel.Excellent;
    if (score >= 80) return ImageIntelligenceHealthLevel.Good;
    if (score >= 60) return ImageIntelligenceHealthLevel.Warning;
    if (score >= 40) return ImageIntelligenceHealthLevel.Critical;
    return ImageIntelligenceHealthLevel.Failed;
  }

  verifyLogDirectory(logDir: string): boolean {
    return fs.existsSync(logDir);
  }

  verifyStorageWritable(intelligenceRoot: string): boolean {
    try {
      const testFile = path.join(intelligenceRoot, ".write-test");
      fs.writeFileSync(testFile, "ok", "utf8");
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }
}
