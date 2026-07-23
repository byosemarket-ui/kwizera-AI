import crypto from "node:crypto";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { MemoryRecoveryRequest, MemoryRecoverySource, MemoryRecoveryType } from "./types.js";

export interface CorruptionReport {
  detected: boolean;
  issues: string[];
  isolatedPaths: string[];
}

export class AutoRecoveryMonitor {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: MemoryRecoveryLogger
  ) {}

  detectCorruption(): CorruptionReport {
    const issues: string[] = [];
    const isolatedPaths: string[] = [];

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

  resolveBackupId(request: MemoryRecoveryRequest): string | null {
    const backup = this.foundation.getMemoryBackupEngine();

    if (request.backupId) return request.backupId;

    if (request.restorePointId) {
      const point = backup.listRestorePoints().find((p) => p.restorePointId === request.restorePointId);
      return point?.backupId ?? null;
    }

    const history = backup.getVersionHistory();
    const validated = history.filter((m) => m.validated);
    if (validated.length === 0) return null;

    if (request.source === MemoryRecoverySource.RestorePoint) {
      const points = backup.listRestorePoints();
      const latest = points[points.length - 1];
      return latest?.backupId ?? validated[0].backupId;
    }

    return validated[0].backupId;
  }

  buildEmergencyRequest(reason: string): MemoryRecoveryRequest {
    return {
      recoveryType: MemoryRecoveryType.Emergency,
      source: MemoryRecoverySource.RestorePoint,
      reason,
    };
  }

  generateRecoveryId(): string {
    return `rec-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  }
}
