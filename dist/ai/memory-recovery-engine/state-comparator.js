export class StateComparator {
    foundation;
    constructor(foundation) {
        this.foundation = foundation;
    }
    compare(backupId) {
        const backup = this.foundation.getMemoryBackupEngine();
        const manifest = backup.getVersionHistory().find((m) => m.backupId === backupId);
        const differences = [];
        const currentRecords = this.foundation.getStorageEngine().getRecordCount();
        const currentEdges = this.foundation.getRelationshipMemoryEngine().getGraph().edgeCount;
        const backupRecordCount = manifest?.recordCount ?? 0;
        const backupEdgeCount = manifest?.edgeCount ?? 0;
        if (backupRecordCount !== currentRecords) {
            differences.push(`Record count: backup=${backupRecordCount}, current=${currentRecords}`);
        }
        if (backupEdgeCount !== currentEdges) {
            differences.push(`Edge count: backup=${backupEdgeCount}, current=${currentEdges}`);
        }
        return {
            backupRecordCount,
            currentRecordCount: currentRecords,
            backupEdgeCount,
            currentEdgeCount: currentEdges,
            filesToRestore: manifest?.files.length ?? 0,
            differences,
        };
    }
}
//# sourceMappingURL=state-comparator.js.map