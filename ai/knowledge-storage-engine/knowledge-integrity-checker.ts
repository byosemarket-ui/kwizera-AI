import fs from "node:fs";
import { yieldEventLoop } from "../../config/yield-event-loop.js";
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
    const acc = this.emptyAccumulator();
    for (const entry of this.index.getIndex().entries) this.applyEntry(entry, acc);
    return this.finish(acc);
  }

  /** Same scan as runFullCheck, but yields so HTTP can run during startup. */
  async runFullCheckAsync(): Promise<KnowledgeIntegrityCheckResult> {
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
    versionIntegrity: boolean;
    filesAvailable: boolean;
  } {
    return {
      issues: [],
      recordsChecked: 0,
      relationshipsValid: true,
      metadataAccurate: true,
      versionIntegrity: true,
      filesAvailable: true,
    };
  }

  private applyEntry(
    entry: { knowledgeId: string; storageLocation: string; contentHash?: string },
    acc: ReturnType<KnowledgeIntegrityChecker["emptyAccumulator"]>
  ): void {
    acc.recordsChecked += 1;
    const recordPath = entry.storageLocation;

    if (!fs.existsSync(recordPath)) {
      acc.issues.push(`Storage path missing for ${entry.knowledgeId}`);
      acc.filesAvailable = false;
      return;
    }

    if (!this.store.verifyRecordChecksum(recordPath)) {
      acc.issues.push(`Checksum failed for ${entry.knowledgeId}`);
      acc.metadataAccurate = false;
    }

    const { data } = this.store.readRecord<KnowledgeRecord>(recordPath);
    if (!data) {
      acc.issues.push(`Cannot read record ${entry.knowledgeId}`);
      acc.filesAvailable = false;
      return;
    }

    const integrity = this.validator.validateRecordIntegrity(data);
    if (!integrity.valid) {
      acc.issues.push(...integrity.diagnostics.map((d) => `${entry.knowledgeId}: ${d}`));
      acc.metadataAccurate = false;
    }

    for (const relatedId of data.relatedKnowledge) {
      if (relatedId !== entry.knowledgeId && !this.index.findById(relatedId)) {
        acc.issues.push(`Broken related knowledge link: ${entry.knowledgeId} -> ${relatedId}`);
        acc.relationshipsValid = false;
      }
    }

    if (entry.contentHash !== data.contentHash) {
      acc.issues.push(`Index metadata mismatch for ${entry.knowledgeId}`);
      acc.metadataAccurate = false;
    }

    const versions = this.versionManager.listVersions(recordPath);
    if (data.version > 1 && versions.length === 0) {
      acc.issues.push(`Missing version history for ${entry.knowledgeId}`);
      acc.versionIntegrity = false;
    }
  }

  private finish(acc: ReturnType<KnowledgeIntegrityChecker["emptyAccumulator"]>): KnowledgeIntegrityCheckResult {
    const verified = acc.issues.length === 0;
    this.logger.log(verified ? "info" : "warn", "integrity", "Knowledge integrity check complete", {
      recordsChecked: acc.recordsChecked,
      issues: acc.issues.length,
    });
    return {
      verified,
      recordsChecked: acc.recordsChecked,
      issues: acc.issues,
      relationshipsValid: acc.relationshipsValid,
      metadataAccurate: acc.metadataAccurate,
      versionIntegrity: acc.versionIntegrity,
      filesAvailable: acc.filesAvailable,
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
