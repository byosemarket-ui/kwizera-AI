import { MemoryHealthScoreLevel, MonitoredModule, } from "./types.js";
export class ModuleHealthChecker {
    foundation;
    constructor(foundation) {
        this.foundation = foundation;
    }
    checkAll() {
        const scores = [];
        scores.push(this.checkModule(MonitoredModule.StorageEngine, () => {
            const r = this.foundation.getStorageEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.storageStatus === "available", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.IndexEngine, () => {
            const r = this.foundation.getIndexEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.RetrievalEngine, () => {
            const r = this.foundation.getRetrievalEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.LearningMemory, () => {
            const r = this.foundation.getLearningMemoryEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.ProjectMemory, () => {
            const r = this.foundation.getProjectMemoryEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.VideoMemory, () => {
            const r = this.foundation.getVideoMemoryEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.MarketingMemory, () => {
            const r = this.foundation.getMarketingMemoryEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.ProductMemory, () => {
            const r = this.foundation.getProductMemoryEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.RelationshipMemory, () => {
            const r = this.foundation.getRelationshipMemoryEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.OptimizationEngine, () => {
            const r = this.foundation.getMemoryOptimizationEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.BackupEngine, () => {
            const r = this.foundation.getMemoryBackupEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        scores.push(this.checkModule(MonitoredModule.RecoveryEngine, () => {
            const r = this.foundation.getMemoryRecoveryEngine().buildStatusReport();
            return { score: r.readinessScore, available: r.engineStatus === "operational", issues: r.knownIssues };
        }));
        const registry = this.foundation.getRegistry();
        const modules = registry.getAllModules();
        scores.push({
            module: MonitoredModule.MemoryRegistry,
            score: registry.verifyChecksum() ? 100 : 60,
            level: registry.verifyChecksum() ? MemoryHealthScoreLevel.Excellent : MemoryHealthScoreLevel.Warning,
            available: modules.length >= 12,
            issues: registry.verifyChecksum() ? [] : ["Registry checksum invalid"],
        });
        const retrieval = this.foundation.getRetrievalEngine().buildStatusReport();
        scores.push({
            module: MonitoredModule.MemoryCache,
            score: retrieval.cacheStatus.hitRate >= 0 ? Math.min(100, 70 + retrieval.cacheStatus.hitRate / 5) : 80,
            level: MemoryHealthScoreLevel.Good,
            available: true,
            issues: [],
        });
        scores.push({
            module: MonitoredModule.MemorySearch,
            score: retrieval.readinessScore,
            level: this.scoreToLevel(retrieval.readinessScore),
            available: retrieval.engineStatus === "operational",
            issues: retrieval.knownIssues,
        });
        const persistence = this.foundation.buildStatusReport();
        scores.push({
            module: MonitoredModule.PersistentMemory,
            score: persistence.readinessScore,
            level: this.scoreToLevel(persistence.readinessScore),
            available: persistence.foundationStatus === "operational",
            issues: persistence.knownIssues,
        });
        scores.push({
            module: MonitoredModule.MemoryDatabase,
            score: 100,
            level: MemoryHealthScoreLevel.Excellent,
            available: true,
            issues: [],
        });
        scores.push({
            module: MonitoredModule.MemoryStorage,
            score: this.foundation.getStorageEngine().buildStatusReport().readinessScore,
            level: this.scoreToLevel(this.foundation.getStorageEngine().buildStatusReport().readinessScore),
            available: this.foundation.getStorageEngine().isStorageAvailable(),
            issues: [],
        });
        return scores;
    }
    checkModule(module, fn) {
        const result = fn();
        return {
            module,
            score: result.score,
            level: this.scoreToLevel(result.score),
            available: result.available,
            issues: result.issues,
        };
    }
    scoreToLevel(score) {
        if (score >= 95)
            return MemoryHealthScoreLevel.Excellent;
        if (score >= 80)
            return MemoryHealthScoreLevel.Good;
        if (score >= 60)
            return MemoryHealthScoreLevel.Warning;
        if (score >= 40)
            return MemoryHealthScoreLevel.Critical;
        return MemoryHealthScoreLevel.Failed;
    }
}
//# sourceMappingURL=module-health-checker.js.map