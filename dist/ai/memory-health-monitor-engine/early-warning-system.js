import { derivePerformanceIssues } from "./resource-monitor.js";
import { MemoryHealthScoreLevel, MonitoredModule, WarningType, } from "./types.js";
export class EarlyWarningSystem {
    foundation;
    constructor(foundation) {
        this.foundation = foundation;
    }
    async detect(moduleScores, metrics) {
        const warnings = [];
        const storageIntegrity = this.foundation.getStorageEngine().runIntegrityCheck();
        if (!storageIntegrity.verified) {
            warnings.push(this.warn(WarningType.MemoryCorruption, MonitoredModule.StorageEngine, "Memory integrity issues detected", "Run memory recovery from latest backup"));
        }
        const relationship = this.foundation.getRelationshipMemoryEngine().validateIntegrity();
        if (!relationship.valid) {
            warnings.push(this.warn(WarningType.BrokenRelationships, MonitoredModule.RelationshipMemory, "Broken relationship references found", "Run relationship integrity repair"));
        }
        if (metrics.retrievalPerformanceMs > 150) {
            warnings.push(this.warn(WarningType.SlowRetrieval, MonitoredModule.RetrievalEngine, `Retrieval averaging ${metrics.retrievalPerformanceMs}ms`, "Run memory optimization"));
        }
        if (metrics.writePerformanceMs > 150) {
            warnings.push(this.warn(WarningType.SlowStorage, MonitoredModule.StorageEngine, `Writes averaging ${metrics.writePerformanceMs}ms`, "Run storage optimization"));
        }
        const indexReport = this.foundation.getIndexEngine().buildStatusReport();
        if (indexReport.readinessScore < 80) {
            warnings.push(this.warn(WarningType.MissingIndexes, MonitoredModule.IndexEngine, "Index quality below threshold", "Rebuild indexes"));
        }
        const optimization = await this.foundation.getMemoryOptimizationEngine().analyzeMemory();
        if (optimization.duplicateGroups > 0) {
            warnings.push(this.warn(WarningType.DuplicateRecords, MonitoredModule.OptimizationEngine, `${optimization.duplicateGroups} duplicate group(s) found`, "Run deduplication"));
        }
        if (optimization.fragmentationScore > 30) {
            warnings.push(this.warn(WarningType.StorageFragmentation, MonitoredModule.OptimizationEngine, `Fragmentation score ${optimization.fragmentationScore}`, "Run full optimization"));
        }
        const backup = this.foundation.getMemoryBackupEngine().buildStatusReport();
        if (backup.totalBackups === 0) {
            warnings.push(this.warn(WarningType.BackupFailure, MonitoredModule.BackupEngine, "No validated backups found", "Create manual backup immediately"));
        }
        const recovery = this.foundation.getMemoryRecoveryEngine().buildStatusReport();
        if (recovery.successfulRecoveries === 0 && recovery.totalRecoveries > 0) {
            warnings.push(this.warn(WarningType.RecoveryProblem, MonitoredModule.RecoveryEngine, "Recovery success rate below 100%", "Review recovery history"));
        }
        if (metrics.diskUsageMb > 3000) {
            warnings.push(this.warn(WarningType.HighDiskUsage, MonitoredModule.MemoryStorage, `${metrics.diskUsageMb}MB disk used`, "Archive inactive records"));
        }
        if (metrics.memoryUsageMb > 400) {
            warnings.push(this.warn(WarningType.HighMemoryUsage, MonitoredModule.MemoryCache, `${metrics.memoryUsageMb}MB heap used`, "Optimize cache"));
        }
        for (const issue of derivePerformanceIssues(metrics, moduleScores)) {
            if (!warnings.some((w) => w.message.includes(issue))) {
                warnings.push(this.warn(WarningType.SlowRetrieval, MonitoredModule.MemorySearch, issue, "Monitor performance trends"));
            }
        }
        for (const mod of moduleScores) {
            if (mod.level === MemoryHealthScoreLevel.Critical || mod.level === MemoryHealthScoreLevel.Failed) {
                warnings.push(this.warn(WarningType.MemoryCorruption, mod.module, `${mod.module} health critical (${mod.score})`, `Inspect ${mod.module} diagnostics`));
            }
        }
        return warnings;
    }
    warn(type, module, message, recommendation) {
        return {
            type,
            severity: MemoryHealthScoreLevel.Warning,
            message,
            module,
            recommendation,
        };
    }
}
//# sourceMappingURL=early-warning-system.js.map