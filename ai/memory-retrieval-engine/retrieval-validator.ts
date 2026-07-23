import type { MemoryRecord } from "../memory-storage-engine/types.js";
import { MemoryIntegrityStatus } from "../memory-storage-engine/types.js";
import type { AiMemoryStorageEngine } from "../memory-storage-engine/memory-storage-engine.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";

export interface RetrievalValidationResult {
  valid: boolean;
  diagnostics: string[];
  recoverySuggestion?: string;
}

export class RetrievalValidator {
  constructor(
    private readonly logger: MemoryRetrievalLogger,
    private readonly storageEngine: AiMemoryStorageEngine
  ) {}

  async validateForRetrieval(memoryId: string, requesterId: string): Promise<RetrievalValidationResult> {
    const diagnostics: string[] = [];

    const indexEntry = this.storageEngine.findIndexEntry(memoryId);
    if (!indexEntry) {
      diagnostics.push(`Memory not found in index: ${memoryId}`);
      return {
        valid: false,
        diagnostics,
        recoverySuggestion: "Run memory storage integrity check and verify index synchronization",
      };
    }

    if (!this.storageEngine.isStorageAvailable()) {
      diagnostics.push("Storage is unavailable");
      return {
        valid: false,
        diagnostics,
        recoverySuggestion: "Verify storage root accessibility at D:\\KWIZERA-AI-STUDIO",
      };
    }

    const read = await this.storageEngine.getRecord(memoryId, requesterId);
    if (!read.success || !read.record) {
      diagnostics.push(read.message ?? "Failed to read memory record");
      return {
        valid: false,
        diagnostics,
        recoverySuggestion: "Attempt recovery via Memory Foundation recover() or restore from backup",
      };
    }

    const record = read.record;
    if (record.integrityStatus === MemoryIntegrityStatus.Corrupted) {
      diagnostics.push("Memory record is corrupted");
      return {
        valid: false,
        diagnostics,
        recoverySuggestion: `Restore version from ${record.storageLocation}/versions/`,
      };
    }

    if (!this.storageEngine.verifyRecordChecksum(memoryId)) {
      diagnostics.push("Record checksum verification failed");
      return {
        valid: false,
        diagnostics,
        recoverySuggestion: "Re-run storage integrity check and restore from version history",
      };
    }

    const integrity = this.storageEngine.validateRecordIntegrity(record);
    if (!integrity.valid) {
      diagnostics.push(...integrity.diagnostics);
      return {
        valid: false,
        diagnostics,
        recoverySuggestion: "Restore previous version or re-index memory record",
      };
    }

    return { valid: true, diagnostics: [] };
  }

  validateRecord(record: MemoryRecord): RetrievalValidationResult {
    if (record.integrityStatus === MemoryIntegrityStatus.Corrupted) {
      this.logger.log("warn", "validation", "Corrupted record detected", { memoryId: record.memoryId });
      return {
        valid: false,
        diagnostics: ["Record integrity status is corrupted"],
        recoverySuggestion: "Restore from version history",
      };
    }
    return { valid: true, diagnostics: [] };
  }
}
