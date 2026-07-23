/**
 * KWIZERA AI STUDIO — Memory Health Monitor Engine types (Step 3N)
 */
export var MemoryHealthScoreLevel;
(function (MemoryHealthScoreLevel) {
    MemoryHealthScoreLevel["Excellent"] = "excellent";
    MemoryHealthScoreLevel["Good"] = "good";
    MemoryHealthScoreLevel["Warning"] = "warning";
    MemoryHealthScoreLevel["Critical"] = "critical";
    MemoryHealthScoreLevel["Failed"] = "failed";
})(MemoryHealthScoreLevel || (MemoryHealthScoreLevel = {}));
export var MonitoredModule;
(function (MonitoredModule) {
    MonitoredModule["PersistentMemory"] = "persistent-memory";
    MonitoredModule["StorageEngine"] = "memory-storage-engine";
    MonitoredModule["IndexEngine"] = "memory-index-engine";
    MonitoredModule["RetrievalEngine"] = "memory-retrieval-engine";
    MonitoredModule["LearningMemory"] = "learning-memory-engine";
    MonitoredModule["ProjectMemory"] = "project-memory-engine";
    MonitoredModule["VideoMemory"] = "video-memory-engine";
    MonitoredModule["MarketingMemory"] = "marketing-memory-engine";
    MonitoredModule["ProductMemory"] = "product-memory-engine";
    MonitoredModule["RelationshipMemory"] = "relationship-memory-engine";
    MonitoredModule["OptimizationEngine"] = "memory-optimization-engine";
    MonitoredModule["BackupEngine"] = "memory-backup-engine";
    MonitoredModule["RecoveryEngine"] = "memory-recovery-engine";
    MonitoredModule["MemoryRegistry"] = "memory-registry";
    MonitoredModule["MemoryDatabase"] = "memory-database";
    MonitoredModule["MemoryCache"] = "memory-cache";
    MonitoredModule["MemorySearch"] = "memory-search";
    MonitoredModule["MemoryStorage"] = "memory-storage";
})(MonitoredModule || (MonitoredModule = {}));
export var WarningType;
(function (WarningType) {
    WarningType["MemoryCorruption"] = "memory-corruption";
    WarningType["SlowRetrieval"] = "slow-retrieval";
    WarningType["SlowStorage"] = "slow-storage";
    WarningType["BrokenRelationships"] = "broken-relationships";
    WarningType["MissingIndexes"] = "missing-indexes";
    WarningType["DuplicateRecords"] = "duplicate-records";
    WarningType["StorageFragmentation"] = "storage-fragmentation";
    WarningType["DatabaseError"] = "database-error";
    WarningType["BackupFailure"] = "backup-failure";
    WarningType["RecoveryProblem"] = "recovery-problem";
    WarningType["HighDiskUsage"] = "high-disk-usage";
    WarningType["HighMemoryUsage"] = "high-memory-usage";
})(WarningType || (WarningType = {}));
export class MemoryHealthMonitorEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryHealthMonitorEngineError";
    }
}
//# sourceMappingURL=types.js.map