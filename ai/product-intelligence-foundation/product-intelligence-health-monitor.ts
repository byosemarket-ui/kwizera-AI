import fs from "node:fs";
import path from "node:path";
import {
  ProductIntelligenceHealthLevel,
  ProductIntelligenceHealthReport,
  ProductIntelligenceModuleRegistration,
} from "./types.js";
import { PREPARED_PRODUCT_INTELLIGENCE_MODULES } from "./product-intelligence-categories.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
import { ProductIntelligenceAccessCoordinator } from "./product-intelligence-access-coordinator.js";
import { ProductIntelligenceRegistry } from "./product-intelligence-registry.js";
import { ProductIntelligenceStorageManager } from "./product-intelligence-storage.js";

export class ProductIntelligenceHealthMonitor {
  private lastReport: ProductIntelligenceHealthReport | null = null;

  constructor(private readonly logger: ProductIntelligenceFoundationLogger) {}

  async runHealthCheck(
    storage: ProductIntelligenceStorageManager,
    registry: ProductIntelligenceRegistry,
    access: ProductIntelligenceAccessCoordinator,
    integrationReady: boolean
  ): Promise<ProductIntelligenceHealthReport> {
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
        m.healthStatus === ProductIntelligenceHealthLevel.Critical ||
        m.healthStatus === ProductIntelligenceHealthLevel.Failed
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

    const report: ProductIntelligenceHealthReport = {
      level,
      score,
      availability: persistence.passed,
      storageIntegrity: checksumOk && persistence.passed,
      registryHealth: checksumOk && modules.length >= PREPARED_PRODUCT_INTELLIGENCE_MODULES.length,
      qualityValidation: true,
      integrationReady,
      readPerformanceMs: readMs,
      writePerformanceMs: writeMs,
      issues,
      timestamp: new Date().toISOString(),
    };

    this.lastReport = report;
    const durationMs = Date.now() - start;

    this.logger.log("info", "health", "Product Intelligence health check complete", {
      score,
      level,
      durationMs,
      issues: issues.length,
    });

    return report;
  }

  getLastReport(): ProductIntelligenceHealthReport | null {
    return this.lastReport;
  }

  verifyRegistryHealth(modules: ProductIntelligenceModuleRegistration[]): boolean {
    return (
      modules.length >= PREPARED_PRODUCT_INTELLIGENCE_MODULES.length &&
      modules.every((m) => m.storageLocation.length > 0)
    );
  }

  private scoreToLevel(score: number): ProductIntelligenceHealthLevel {
    if (score >= 95) return ProductIntelligenceHealthLevel.Excellent;
    if (score >= 80) return ProductIntelligenceHealthLevel.Good;
    if (score >= 60) return ProductIntelligenceHealthLevel.Warning;
    if (score >= 40) return ProductIntelligenceHealthLevel.Critical;
    return ProductIntelligenceHealthLevel.Failed;
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
