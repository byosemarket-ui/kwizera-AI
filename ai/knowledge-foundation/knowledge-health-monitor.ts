import fs from "node:fs";
import path from "node:path";
import {
  KnowledgeHealthLevel,
  KnowledgeHealthReport,
  KnowledgeModuleRegistration,
} from "./types.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeAccessCoordinator } from "./knowledge-access-coordinator.js";
import { KnowledgeRegistry } from "./knowledge-registry.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";

export class KnowledgeHealthMonitor {
  private lastReport: KnowledgeHealthReport | null = null;

  constructor(private readonly logger: KnowledgeFoundationLogger) {}

  async runHealthCheck(
    storage: KnowledgeStorageManager,
    registry: KnowledgeRegistry,
    access: KnowledgeAccessCoordinator,
    integrationReady: boolean
  ): Promise<KnowledgeHealthReport> {
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
      (m) => m.healthStatus === KnowledgeHealthLevel.Critical || m.healthStatus === KnowledgeHealthLevel.Failed
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
      registry.updateHealth(mod.knowledgeId, level);
    }

    const report: KnowledgeHealthReport = {
      level,
      score,
      availability: persistence.passed,
      storageIntegrity: checksumOk && persistence.passed,
      registryHealth: checksumOk && modules.length >= 12,
      qualityValidation: true,
      integrationReady,
      readPerformanceMs: readMs,
      writePerformanceMs: writeMs,
      issues,
      timestamp: new Date().toISOString(),
    };

    this.lastReport = report;
    const durationMs = Date.now() - start;

    this.logger.log("info", "health", "Knowledge health check complete", {
      score,
      level,
      durationMs,
      issues: issues.length,
    });

    return report;
  }

  getLastReport(): KnowledgeHealthReport | null {
    return this.lastReport;
  }

  verifyRegistryHealth(modules: KnowledgeModuleRegistration[]): boolean {
    return modules.length >= 12 && modules.every((m) => m.storageLocation.length > 0);
  }

  private scoreToLevel(score: number): KnowledgeHealthLevel {
    if (score >= 95) return KnowledgeHealthLevel.Excellent;
    if (score >= 80) return KnowledgeHealthLevel.Good;
    if (score >= 60) return KnowledgeHealthLevel.Warning;
    if (score >= 40) return KnowledgeHealthLevel.Critical;
    return KnowledgeHealthLevel.Failed;
  }

  verifyLogDirectory(logDir: string): boolean {
    return fs.existsSync(logDir);
  }

  verifyStorageWritable(knowledgeRoot: string): boolean {
    try {
      const testFile = path.join(knowledgeRoot, ".write-test");
      fs.writeFileSync(testFile, "ok", "utf8");
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }
}
