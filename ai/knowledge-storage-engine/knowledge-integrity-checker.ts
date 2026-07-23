import fs from "node:fs";
import { KnowledgeIntegrityCheckResult, KnowledgeRecord } from "./types.js";
import { KnowledgeRecordValidator } from "./knowledge-record-validator.js";
import { KnowledgeRecordIndex } from "./knowledge-record-index.js";
import { KnowledgeRecordStore } from "./knowledge-record-store.js";
import { KnowledgeVersionManager } from "./knowledge-version-manager.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";

export class KnowledgeIntegrityChecker {
  constructor(
    private readonly logger: KnowledgeStorageLogger,
    private readonly validator: KnowledgeRecordValidator,
    private readonly store: KnowledgeRecordStore,
    private readonly index: KnowledgeRecordIndex,
    private readonly versionManager: KnowledgeVersionManager
  ) {}

  runFullCheck(): KnowledgeIntegrityCheckResult {
    const issues: string[] = [];
    let recordsChecked = 0;
    let relationshipsValid = true;
    let metadataAccurate = true;
    let versionIntegrity = true;
    let filesAvailable = true;

    for (const entry of this.index.getIndex().entries) {
      recordsChecked++;
      const recordPath = entry.storageLocation;

      if (!fs.existsSync(recordPath)) {
        issues.push(`Storage path missing for ${entry.knowledgeId}`);
        filesAvailable = false;
        continue;
      }

      if (!this.store.verifyRecordChecksum(recordPath)) {
        issues.push(`Checksum failed for ${entry.knowledgeId}`);
        metadataAccurate = false;
      }

      const { data } = this.store.readRecord<KnowledgeRecord>(recordPath);
      if (!data) {
        issues.push(`Cannot read record ${entry.knowledgeId}`);
        filesAvailable = false;
        continue;
      }

      const integrity = this.validator.validateRecordIntegrity(data);
      if (!integrity.valid) {
        issues.push(...integrity.diagnostics.map((d) => `${entry.knowledgeId}: ${d}`));
        metadataAccurate = false;
      }

      for (const relatedId of data.relatedKnowledge) {
        if (relatedId !== entry.knowledgeId && !this.index.findById(relatedId)) {
          issues.push(`Broken related knowledge link: ${entry.knowledgeId} -> ${relatedId}`);
          relationshipsValid = false;
        }
      }

      if (entry.contentHash !== data.contentHash) {
        issues.push(`Index metadata mismatch for ${entry.knowledgeId}`);
        metadataAccurate = false;
      }

      const versions = this.versionManager.listVersions(recordPath);
      if (data.version > 1 && versions.length === 0) {
        issues.push(`Missing version history for ${entry.knowledgeId}`);
        versionIntegrity = false;
      }
    }

    const verified = issues.length === 0;
    this.logger.log(verified ? "info" : "warn", "integrity", "Knowledge integrity check complete", {
      recordsChecked,
      issues: issues.length,
    });

    return {
      verified,
      recordsChecked,
      issues,
      relationshipsValid,
      metadataAccurate,
      versionIntegrity,
      filesAvailable,
      timestamp: new Date().toISOString(),
    };
  }

  verifySingleRecord(record: KnowledgeRecord): boolean {
    return (
      this.validator.validateRecordIntegrity(record).valid &&
      this.store.verifyRecordChecksum(record.storageLocation)
    );
  }
}
