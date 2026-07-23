import fs from "node:fs";
import path from "node:path";
import { MemoryHealthLevel, } from "./types.js";
export class MemoryHealthMonitor {
    logger;
    lastReport = null;
    constructor(logger) {
        this.logger = logger;
    }
    async runHealthCheck(storage, registry, access) {
        const start = Date.now();
        const issues = [];
        const persistence = storage.verifyPersistence();
        if (!persistence.passed) {
            issues.push(persistence.detail);
        }
        const checksumOk = registry.verifyChecksum();
        if (!checksumOk) {
            issues.push("Registry checksum invalid");
        }
        const modules = registry.getAllModules();
        const failedModules = modules.filter((m) => m.healthStatus === MemoryHealthLevel.Critical || m.healthStatus === MemoryHealthLevel.Failed);
        if (failedModules.length > 0) {
            issues.push(`${failedModules.length} module(s) in critical/failed health`);
        }
        const readMs = access.getAverageReadMs() || 1;
        const writeMs = access.getAverageWriteMs() || 1;
        let score = 100;
        if (!persistence.passed)
            score -= 30;
        if (!checksumOk)
            score -= 20;
        if (failedModules.length > 0)
            score -= 15;
        if (readMs > 100)
            score -= 5;
        if (writeMs > 100)
            score -= 5;
        score = Math.max(0, Math.min(100, score));
        const level = this.scoreToLevel(score);
        for (const mod of modules) {
            registry.updateHealth(mod.memoryId, level);
        }
        const report = {
            level,
            score,
            availability: persistence.passed,
            storageIntegrity: checksumOk && persistence.passed,
            registryHealth: checksumOk && modules.length >= 12,
            consistency: issues.length === 0,
            readPerformanceMs: readMs,
            writePerformanceMs: writeMs,
            issues,
            timestamp: new Date().toISOString(),
        };
        this.lastReport = report;
        const durationMs = Date.now() - start;
        this.logger.log("info", "health", "Memory health check complete", {
            score,
            level,
            durationMs,
            issues: issues.length,
        });
        return report;
    }
    getLastReport() {
        return this.lastReport;
    }
    verifyRegistryHealth(modules) {
        return modules.length >= 12 && modules.every((m) => m.storageLocation.length > 0);
    }
    scoreToLevel(score) {
        if (score >= 95)
            return MemoryHealthLevel.Excellent;
        if (score >= 80)
            return MemoryHealthLevel.Good;
        if (score >= 60)
            return MemoryHealthLevel.Warning;
        if (score >= 40)
            return MemoryHealthLevel.Critical;
        return MemoryHealthLevel.Failed;
    }
    verifyLogDirectory(logDir) {
        return fs.existsSync(logDir);
    }
    verifyStorageWritable(memoryRoot) {
        try {
            const testFile = path.join(memoryRoot, ".write-test");
            fs.writeFileSync(testFile, "ok", "utf8");
            fs.unlinkSync(testFile);
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=memory-health-monitor.js.map