import fs from "node:fs";
import { yieldEventLoop } from "../../config/yield-event-loop.js";
import { IntegrityCheckResult, MemoryRecord } from "./types.js";
import { RecordValidator } from "./record-validator.js";
import { RecordIndex } from "./record-index.js";
import { RecordStore } from "./record-store.js";
import { MemoryStorageLogger } from "./storage-logger.js";

export class IntegrityChecker {
  constructor(
    private readonly logger: MemoryStorageLogger,
    private readonly validator: RecordValidator,
    private readonly store: RecordStore,
    private readonly index: RecordIndex
  ) {}

  runFullCheck(): IntegrityCheckResult {
    const acc = this.emptyAccumulator();
    for (const entry of this.index.getIndex().entries) this.applyEntry(entry, acc);
    return this.finish(acc);
  }

  async runFullCheckAsync(): Promise<IntegrityCheckResult> {
    const acc = this.emptyAccumulator();
    let n = 0;
    for (const entry of this.index.getIndex().entries) {
      this.applyEntry(entry, acc);
      n += 1;
      if (n % 4 === 0) await yieldEventLoop();
    }
    return this.finish(acc);
  }

  private emptyAccumulator(): {
    issues: string[];
    recordsChecked: number;
    relationshipsValid: boolean;
    metadataAccurate: boolean;
    filesAvailable: boolean;
  } {
    return {
      issues: [],
      recordsChecked: 0,
      relationshipsValid: true,
      metadataAccurate: true,
      filesAvailable: true,
    };
  }

  private applyEntry(
    entry: { memoryId: string; storageLocation: string; contentHash?: string },
    acc: ReturnType<IntegrityChecker["emptyAccumulator"]>
  ): void {
    acc.recordsChecked += 1;
    const recordPath = entry.storageLocation;

    if (!fs.existsSync(recordPath)) {
      acc.issues.push(`Storage path missing for ${entry.memoryId}`);
      acc.filesAvailable = false;
      return;
    }

    if (!this.store.verifyRecordChecksum(recordPath)) {
      acc.issues.push(`Checksum failed for ${entry.memoryId}`);
      acc.metadataAccurate = false;
    }

    const { data } = this.store.readRecord<MemoryRecord>(recordPath);
    if (!data) {
      acc.issues.push(`Cannot read record ${entry.memoryId}`);
      acc.filesAvailable = false;
      return;
    }

    const integrity = this.validator.validateRecordIntegrity(data);
    if (!integrity.valid) {
      acc.issues.push(...integrity.diagnostics.map((d) => `${entry.memoryId}: ${d}`));
      acc.metadataAccurate = false;
    }

    if (entry.contentHash !== data.contentHash) {
      acc.issues.push(`Index metadata mismatch for ${entry.memoryId}`);
      acc.metadataAccurate = false;
    }
  }

  private finish(acc: ReturnType<IntegrityChecker["emptyAccumulator"]>): IntegrityCheckResult {
    const verified = acc.issues.length === 0;
    this.logger.log(verified ? "info" : "warn", "integrity", "Integrity check complete", {
      recordsChecked: acc.recordsChecked,
      issues: acc.issues.length,
    });
    return {
      verified,
      recordsChecked: acc.recordsChecked,
      issues: acc.issues,
      relationshipsValid: acc.relationshipsValid,
      metadataAccurate: acc.metadataAccurate,
      filesAvailable: acc.filesAvailable,
      timestamp: new Date().toISOString(),
    };
  }

  verifySingleRecord(record: MemoryRecord): boolean {
    return this.validator.validateRecordIntegrity(record).valid &&
      this.store.verifyRecordChecksum(record.storageLocation);
  }
}
