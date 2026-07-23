import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { StateComparison } from "./types.js";

export class StateComparator {
  constructor(private readonly foundation: AiMemoryFoundation) {}

  compare(backupId: string): StateComparison {
    const backup = this.foundation.getMemoryBackupEngine();
    const manifest = backup.getVersionHistory().find((m) => m.backupId === backupId);
    const differences: string[] = [];

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
