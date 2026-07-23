/**
 * KWIZERA AI STUDIO — Memory Recovery Engine types (Step 3M)
 */
export var MemoryRecoveryType;
(function (MemoryRecoveryType) {
    MemoryRecoveryType["Full"] = "full";
    MemoryRecoveryType["Selective"] = "selective";
    MemoryRecoveryType["Project"] = "project";
    MemoryRecoveryType["Memory"] = "memory";
    MemoryRecoveryType["Database"] = "database";
    MemoryRecoveryType["Configuration"] = "configuration";
    MemoryRecoveryType["Learning"] = "learning";
    MemoryRecoveryType["Relationship"] = "relationship";
    MemoryRecoveryType["Emergency"] = "emergency";
})(MemoryRecoveryType || (MemoryRecoveryType = {}));
export var MemoryRecoverySource;
(function (MemoryRecoverySource) {
    MemoryRecoverySource["AutomaticBackup"] = "automatic-backup";
    MemoryRecoverySource["ManualBackup"] = "manual-backup";
    MemoryRecoverySource["IncrementalBackup"] = "incremental-backup";
    MemoryRecoverySource["FullBackup"] = "full-backup";
    MemoryRecoverySource["RestorePoint"] = "restore-point";
    MemoryRecoverySource["ProjectSnapshot"] = "project-snapshot";
    MemoryRecoverySource["RecoverySnapshot"] = "recovery-snapshot";
})(MemoryRecoverySource || (MemoryRecoverySource = {}));
export class MemoryRecoveryEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryRecoveryEngineError";
    }
}
//# sourceMappingURL=types.js.map