import fs from "node:fs";
import path from "node:path";
import { VideoIntelligenceHealthLevel, } from "./types.js";
import { PREPARED_VIDEO_INTELLIGENCE_MODULES } from "./video-intelligence-categories.js";
export class VideoIntelligenceHealthMonitor {
    logger;
    lastReport = null;
    constructor(logger) {
        this.logger = logger;
    }
    async runHealthCheck(storage, registry, access, assetRegistry, frameIndex, workflow, integrationReady) {
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
        const failedModules = modules.filter((m) => m.healthStatus === VideoIntelligenceHealthLevel.Critical ||
            m.healthStatus === VideoIntelligenceHealthLevel.Failed);
        if (failedModules.length > 0) {
            issues.push(`${failedModules.length} module(s) in critical/failed health`);
        }
        if (!integrationReady) {
            issues.push("Core integration not fully ready");
        }
        const assetHealth = assetRegistry.verifyIntegrity();
        if (!assetHealth.valid) {
            issues.push(...assetHealth.issues);
        }
        const indexHealth = frameIndex.verifyIntegrity();
        if (!indexHealth.valid) {
            issues.push(...indexHealth.issues);
        }
        const workflowHealth = workflow.verifyIntegrity();
        if (!workflowHealth.valid) {
            issues.push(...workflowHealth.issues);
        }
        const readMs = access.getAverageReadMs() || 1;
        const writeMs = access.getAverageWriteMs() || 1;
        const indexLookupMs = frameIndex.getAverageLookupMs() || 1;
        let score = 100;
        if (!persistence.passed)
            score -= 25;
        if (!checksumOk)
            score -= 15;
        if (failedModules.length > 0)
            score -= 10;
        if (!integrationReady)
            score -= 10;
        if (!assetHealth.valid)
            score -= 10;
        if (!indexHealth.valid)
            score -= 10;
        if (!workflowHealth.valid)
            score -= 5;
        if (readMs > 100)
            score -= 5;
        if (indexLookupMs > 50)
            score -= 5;
        score = Math.max(0, Math.min(100, score));
        const level = this.scoreToLevel(score);
        for (const mod of modules) {
            registry.updateHealth(mod.moduleId, level);
        }
        const report = {
            level,
            score,
            availability: persistence.passed,
            storageIntegrity: checksumOk && persistence.passed,
            registryHealth: checksumOk && modules.length >= PREPARED_VIDEO_INTELLIGENCE_MODULES.length,
            assetRegistryHealth: assetHealth.valid,
            frameIndexHealth: indexHealth.valid,
            workflowHealth: workflowHealth.valid,
            qualityValidation: true,
            integrationReady,
            readPerformanceMs: readMs,
            writePerformanceMs: writeMs,
            indexLookupMs,
            issues,
            timestamp: new Date().toISOString(),
        };
        this.lastReport = report;
        const durationMs = Date.now() - start;
        this.logger.log("info", "health", "Video Intelligence health check complete", {
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
        return (modules.length >= PREPARED_VIDEO_INTELLIGENCE_MODULES.length &&
            modules.every((m) => m.storageLocation.length > 0));
    }
    scoreToLevel(score) {
        if (score >= 95)
            return VideoIntelligenceHealthLevel.Excellent;
        if (score >= 80)
            return VideoIntelligenceHealthLevel.Good;
        if (score >= 60)
            return VideoIntelligenceHealthLevel.Warning;
        if (score >= 40)
            return VideoIntelligenceHealthLevel.Critical;
        return VideoIntelligenceHealthLevel.Failed;
    }
    verifyLogDirectory(logDir) {
        return fs.existsSync(logDir);
    }
    verifyStorageWritable(intelligenceRoot) {
        try {
            const testFile = path.join(intelligenceRoot, ".write-test");
            fs.writeFileSync(testFile, "ok", "utf8");
            fs.unlinkSync(testFile);
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=video-intelligence-health-monitor.js.map