import { KnowledgeRecord, KnowledgeRecordInput, KnowledgeRecordUpdate, KnowledgeRecordStatus, KnowledgeStorageValidationResult } from "./types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
export declare class KnowledgeRecordValidator {
    validateInput(input: KnowledgeRecordInput): KnowledgeStorageValidationResult;
    validateUpdate(update: KnowledgeRecordUpdate): KnowledgeStorageValidationResult;
    validateRecordIntegrity(record: KnowledgeRecord): KnowledgeStorageValidationResult;
    resolveVerificationStatus(qualityScore: number, confidenceScore: number, requested?: KnowledgeVerificationStatus): KnowledgeVerificationStatus;
    resolveRecordStatus(verificationStatus: KnowledgeVerificationStatus, requested?: KnowledgeRecordStatus): KnowledgeRecordStatus;
    computeContentHash(record: Pick<KnowledgeRecord, "title" | "description" | "summary" | "tags" | "keywords" | "payload">): string;
    computeFingerprint(knowledgeType: string, title: string, source: string, contentHash: string): string;
    buildSearchableText(record: Pick<KnowledgeRecord, "title" | "description" | "summary" | "tags" | "keywords" | "category">): string;
}
//# sourceMappingURL=knowledge-record-validator.d.ts.map