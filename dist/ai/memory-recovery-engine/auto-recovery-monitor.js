import crypto from "node:crypto";
import { MemoryRecoverySource, MemoryRecoveryType } from "./types.js";
export class AutoRecoveryMonitor {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    detectCorruption() {
        const issues = [];
        const isolatedPaths = [];
        const storageIntegrity = this.foundation.getStorageEngine().runIntegrityCheck();
        if (!storageIntegrity.verified) {
            issues.push(...storageIntegrity.issues);
        }
        const relationshipIntegrity = this.foundation.getRelationshipMemoryEngine().validateIntegrity();
        if (!relationshipIntegrity.valid) {
            issues.push(...relationshipIntegrity.diagnostics.map((d) => d.detail));
        }
        return {
            detected: issues.length > 0,
            issues,
            isolatedPaths,
        };
    }
    resolveBackupId(request) {
        const backup = this.foundation.getMemoryBackupEngine();
        if (request.backupId)
            return request.backupId;
        if (request.restorePointId) {
            const point = backup.listRestorePoints().find((p) => p.restorePointId === request.restorePointId);
            return point?.backupId ?? null;
        }
        const history = backup.getVersionHistory();
        const validated = history.filter((m) => m.validated);
        if (validated.length === 0)
            return null;
        if (request.source === MemoryRecoverySource.RestorePoint) {
            const points = backup.listRestorePoints();
            const latest = points[points.length - 1];
            return latest?.backupId ?? validated[0].backupId;
        }
        return validated[0].backupId;
    }
    buildEmergencyRequest(reason) {
        return {
            recoveryType: MemoryRecoveryType.Emergency,
            source: MemoryRecoverySource.RestorePoint,
            reason,
        };
    }
    generateRecoveryId() {
        return `rec-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    }
}
//# sourceMappingURL=auto-recovery-monitor.js.map