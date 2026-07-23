import fs from "node:fs";
import path from "node:path";
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
    const issues: string[] = [];
    let recordsChecked = 0;
    let relationshipsValid = true;
    let metadataAccurate = true;
    let filesAvailable = true;

    for (const entry of this.index.getIndex().entries) {
      recordsChecked++;
      const recordPath = entry.storageLocation;

      if (!fs.existsSync(recordPath)) {
        issues.push(`Storage path missing for ${entry.memoryId}`);
        filesAvailable = false;
        continue;
      }

      if (!this.store.verifyRecordChecksum(recordPath)) {
        issues.push(`Checksum failed for ${entry.memoryId}`);
        metadataAccurate = false;
      }

      const { data } = this.store.readRecord<MemoryRecord>(recordPath);
      if (!data) {
        issues.push(`Cannot read record ${entry.memoryId}`);
        filesAvailable = false;
        continue;
      }

      const integrity = this.validator.validateRecordIntegrity(data);
      if (!integrity.valid) {
        issues.push(...integrity.diagnostics.map((d) => `${entry.memoryId}: ${d}`));
        metadataAccurate = false;
      }

      if (data.relatedProject && data.relatedFiles.length === 0) {
        relationshipsValid = relationshipsValid && true;
      }

      if (entry.contentHash !== data.contentHash) {
        issues.push(`Index metadata mismatch for ${entry.memoryId}`);
        metadataAccurate = false;
      }
    }

    const verified = issues.length === 0;
    this.logger.log(verified ? "info" : "warn", "integrity", "Integrity check complete", {
      recordsChecked,
      issues: issues.length,
    });

    return {
      verified,
      recordsChecked,
      issues,
      relationshipsValid,
      metadataAccurate,
      filesAvailable,
      timestamp: new Date().toISOString(),
    };
  }

  verifySingleRecord(record: MemoryRecord): boolean {
    return this.validator.validateRecordIntegrity(record).valid &&
      this.store.verifyRecordChecksum(record.storageLocation);
  }
}
