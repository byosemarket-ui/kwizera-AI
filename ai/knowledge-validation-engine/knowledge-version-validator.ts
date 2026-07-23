import fs from "node:fs";
import path from "node:path";
import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import { KnowledgeRecordValidator } from "../knowledge-storage-engine/knowledge-record-validator.js";

export interface VersionValidationResult {
  valid: boolean;
  issues: string[];
}

export class KnowledgeVersionValidator {
  private readonly storageValidator = new KnowledgeRecordValidator();

  validate(record: KnowledgeRecord): VersionValidationResult {
    const issues: string[] = [];

    if (record.version < 1) {
      issues.push("Version number must be at least 1");
    }

    const versionsDir = path.join(record.storageLocation, "versions");
    if (record.version > 1 && !fs.existsSync(versionsDir)) {
      issues.push("Version history directory missing for multi-version record");
    }

    if (record.version > 1 && fs.existsSync(versionsDir)) {
      const prevVersion = record.version - 1;
      const prevPath = path.join(versionsDir, `v${prevVersion}.json`);
      if (!fs.existsSync(prevPath)) {
        issues.push(`Previous version v${prevVersion} not found in version history`);
      }
    }

    const expectedHash = this.storageValidator.computeContentHash(record);
    if (record.contentHash !== expectedHash) {
      issues.push("Content hash does not match record content — version integrity failure");
    }

    if (!record.creationDate || !record.lastUpdated) {
      issues.push("Missing creation or update timestamps");
    }

    if (new Date(record.lastUpdated).getTime() < new Date(record.creationDate).getTime()) {
      issues.push("Last updated timestamp precedes creation date");
    }

    return { valid: issues.length === 0, issues };
  }
}
