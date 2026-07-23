/**
 * KWIZERA AI STUDIO — Memory Backup Engine types (Step 3L)
 */
export var BackupType;
(function (BackupType) {
    BackupType["Automatic"] = "automatic";
    BackupType["Manual"] = "manual";
    BackupType["Incremental"] = "incremental";
    BackupType["Full"] = "full";
    BackupType["Recovery"] = "recovery";
    BackupType["PreUpdate"] = "pre-update";
    BackupType["PreOptimization"] = "pre-optimization";
    BackupType["Scheduled"] = "scheduled";
})(BackupType || (BackupType = {}));
export var BackupSource;
(function (BackupSource) {
    BackupSource["PersistentMemory"] = "persistent-memory";
    BackupSource["ProjectMemory"] = "project-memory";
    BackupSource["ProductMemory"] = "product-memory";
    BackupSource["VideoMemory"] = "video-memory";
    BackupSource["MarketingMemory"] = "marketing-memory";
    BackupSource["LearningMemory"] = "learning-memory";
    BackupSource["KnowledgeMemory"] = "knowledge-memory";
    BackupSource["RelationshipMemory"] = "relationship-memory";
    BackupSource["WorkflowHistory"] = "workflow-history";
    BackupSource["DecisionHistory"] = "decision-history";
    BackupSource["ReasoningHistory"] = "reasoning-history";
    BackupSource["Configuration"] = "configuration";
    BackupSource["Database"] = "database";
    BackupSource["AiSettings"] = "ai-settings";
    BackupSource["UserPreferences"] = "user-preferences";
    BackupSource["ProjectAssets"] = "project-assets";
    BackupSource["GeneratedVideos"] = "generated-videos";
    BackupSource["GeneratedImages"] = "generated-images";
    BackupSource["GeneratedScripts"] = "generated-scripts";
})(BackupSource || (BackupSource = {}));
export var RestoreMode;
(function (RestoreMode) {
    RestoreMode["Full"] = "full";
    RestoreMode["Project"] = "project";
    RestoreMode["Memory"] = "memory";
    RestoreMode["Configuration"] = "configuration";
    RestoreMode["Database"] = "database";
    RestoreMode["Selective"] = "selective";
    RestoreMode["AiRecovery"] = "ai-recovery";
})(RestoreMode || (RestoreMode = {}));
export var RestorePointTrigger;
(function (RestorePointTrigger) {
    RestorePointTrigger["BeforeUpdate"] = "before-update";
    RestorePointTrigger["BeforeOptimization"] = "before-optimization";
    RestorePointTrigger["BeforeMigration"] = "before-database-migration";
    RestorePointTrigger["BeforeConfigurationChange"] = "before-configuration-change";
    RestorePointTrigger["BeforeAiEngineChange"] = "before-ai-engine-change";
    RestorePointTrigger["BeforeMajorProjectChange"] = "before-major-project-change";
})(RestorePointTrigger || (RestorePointTrigger = {}));
export var RetentionTier;
(function (RetentionTier) {
    RetentionTier["Latest"] = "latest";
    RetentionTier["Daily"] = "daily";
    RetentionTier["Weekly"] = "weekly";
    RetentionTier["Monthly"] = "monthly";
    RetentionTier["Milestone"] = "milestone";
})(RetentionTier || (RetentionTier = {}));
export class MemoryBackupEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryBackupEngineError";
    }
}
//# sourceMappingURL=types.js.map