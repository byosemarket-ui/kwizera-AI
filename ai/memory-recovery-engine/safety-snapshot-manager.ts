import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";

export class SafetySnapshotManager {
  private snapshotsDir = "";

  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly storageRoot: string,
    private readonly logger: MemoryRecoveryLogger
  ) {}

  initialize(recoveryDir: string): void {
    this.snapshotsDir = path.join(recoveryDir, "safety-snapshots");
    fs.mkdirSync(this.snapshotsDir, { recursive: true });
  }

  async create(label: string): Promise<string> {
    const snapshotId = `snap-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const result = await this.foundation.getMemoryBackupEngine().createManualBackup();
    const snapshotMeta = {
      snapshotId,
      label,
      backupId: result.backupId,
      createdAt: new Date().toISOString(),
    };

    const metaPath = path.join(this.snapshotsDir, `${snapshotId}.json`);
    fs.writeFileSync(metaPath, JSON.stringify(snapshotMeta, null, 2), "utf8");

    this.logger.log("info", "snapshot", "Safety snapshot created", snapshotMeta);
    return snapshotId;
  }
}
