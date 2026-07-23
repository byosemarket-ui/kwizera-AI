import { MemoryRecord, MemoryRecordInput, MemoryRecordUpdate, StorageValidationResult } from "./types.js";
export declare class RecordValidator {
    validateInput(input: MemoryRecordInput): StorageValidationResult;
    validateUpdate(update: MemoryRecordUpdate): StorageValidationResult;
    validateRecordIntegrity(record: MemoryRecord): StorageValidationResult;
    computeContentHash(record: Pick<MemoryRecord, "title" | "description" | "tags" | "keywords" | "payload">): string;
    computeFingerprint(memoryType: string, title: string, source: string, contentHash: string): string;
    buildSearchableText(record: Pick<MemoryRecord, "title" | "description" | "tags" | "keywords" | "category">): string;
}
//# sourceMappingURL=record-validator.d.ts.map