import crypto from "node:crypto";
import { KnowledgeRecordStatus, KnowledgeStorageValidationCode, } from "./types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
const REQUIRED_FIELDS = [
    "knowledgeType",
    "category",
    "title",
    "description",
    "source",
];
const MIN_TRUSTED_QUALITY = 75;
const MIN_TRUSTED_CONFIDENCE = 70;
export class KnowledgeRecordValidator {
    validateInput(input) {
        const diagnostics = [];
        for (const field of REQUIRED_FIELDS) {
            const value = input[field];
            if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
                diagnostics.push(`Missing required field: ${field}`);
            }
        }
        if (input.title && input.title.length > 500) {
            diagnostics.push("Title exceeds maximum length (500)");
        }
        if (input.qualityScore !== undefined && (input.qualityScore < 0 || input.qualityScore > 100)) {
            diagnostics.push("Quality score must be between 0 and 100");
        }
        if (input.confidenceScore !== undefined && (input.confidenceScore < 0 || input.confidenceScore > 100)) {
            diagnostics.push("Confidence score must be between 0 and 100");
        }
        if (input.sourceReliability !== undefined && (input.sourceReliability < 0 || input.sourceReliability > 100)) {
            diagnostics.push("Source reliability must be between 0 and 100");
        }
        if (input.payload !== undefined && typeof input.payload !== "object") {
            diagnostics.push("Payload must be a valid object");
        }
        const quality = input.qualityScore ?? 80;
        const confidence = input.confidenceScore ?? 75;
        const verification = input.verificationStatus ?? KnowledgeVerificationStatus.Pending;
        if (verification === KnowledgeVerificationStatus.Verified &&
            (quality < MIN_TRUSTED_QUALITY || confidence < MIN_TRUSTED_CONFIDENCE)) {
            diagnostics.push("Unverified knowledge cannot be marked as trusted (verified)");
        }
        if (diagnostics.length > 0) {
            return {
                valid: false,
                code: diagnostics.some((d) => d.startsWith("Missing"))
                    ? KnowledgeStorageValidationCode.MissingRequiredField
                    : diagnostics.some((d) => d.includes("trusted"))
                        ? KnowledgeStorageValidationCode.UnverifiedKnowledge
                        : KnowledgeStorageValidationCode.InvalidData,
                message: "Knowledge record validation failed",
                diagnostics,
            };
        }
        return { valid: true, message: "Knowledge input valid", diagnostics: [] };
    }
    validateUpdate(update) {
        const diagnostics = [];
        if (update.title !== undefined && update.title.trim() === "") {
            diagnostics.push("Title cannot be empty");
        }
        if (update.qualityScore !== undefined && (update.qualityScore < 0 || update.qualityScore > 100)) {
            diagnostics.push("Quality score must be between 0 and 100");
        }
        if (update.confidenceScore !== undefined && (update.confidenceScore < 0 || update.confidenceScore > 100)) {
            diagnostics.push("Confidence score must be between 0 and 100");
        }
        if (update.verificationStatus === KnowledgeVerificationStatus.Verified &&
            (update.qualityScore ?? 100) < MIN_TRUSTED_QUALITY) {
            diagnostics.push("Cannot verify low-quality knowledge");
        }
        if (diagnostics.length > 0) {
            return {
                valid: false,
                code: KnowledgeStorageValidationCode.InvalidData,
                message: "Update validation failed",
                diagnostics,
            };
        }
        return { valid: true, message: "Update valid", diagnostics: [] };
    }
    validateRecordIntegrity(record) {
        const diagnostics = [];
        const expectedHash = this.computeContentHash(record);
        if (record.contentHash !== expectedHash) {
            diagnostics.push("Content hash mismatch — record may be corrupted");
        }
        if (!record.knowledgeId || !record.storageLocation) {
            diagnostics.push("Record missing identity or storage location");
        }
        for (const relatedId of record.relatedKnowledge) {
            if (relatedId === record.knowledgeId) {
                diagnostics.push("Self-referential related knowledge link");
            }
        }
        if (diagnostics.length > 0) {
            return {
                valid: false,
                code: KnowledgeStorageValidationCode.CorruptedRecord,
                message: "Record integrity check failed",
                diagnostics,
            };
        }
        return { valid: true, message: "Record integrity verified", diagnostics: [] };
    }
    resolveVerificationStatus(qualityScore, confidenceScore, requested) {
        if (requested === KnowledgeVerificationStatus.Rejected) {
            return KnowledgeVerificationStatus.Rejected;
        }
        if (qualityScore >= MIN_TRUSTED_QUALITY && confidenceScore >= MIN_TRUSTED_CONFIDENCE) {
            return requested === KnowledgeVerificationStatus.Verified
                ? KnowledgeVerificationStatus.Verified
                : KnowledgeVerificationStatus.Pending;
        }
        return KnowledgeVerificationStatus.Unverified;
    }
    resolveRecordStatus(verificationStatus, requested) {
        if (requested)
            return requested;
        if (verificationStatus === KnowledgeVerificationStatus.Verified) {
            return KnowledgeRecordStatus.Verified;
        }
        if (verificationStatus === KnowledgeVerificationStatus.Rejected) {
            return KnowledgeRecordStatus.Rejected;
        }
        return KnowledgeRecordStatus.Pending;
    }
    computeContentHash(record) {
        const content = JSON.stringify({
            title: record.title,
            description: record.description,
            summary: record.summary,
            tags: record.tags,
            keywords: record.keywords,
            payload: record.payload ?? {},
        });
        return crypto.createHash("sha256").update(content).digest("hex");
    }
    computeFingerprint(knowledgeType, title, source, contentHash) {
        return crypto
            .createHash("sha256")
            .update(`${knowledgeType}:${title.toLowerCase()}:${source}:${contentHash}`)
            .digest("hex")
            .slice(0, 16);
    }
    buildSearchableText(record) {
        return [record.title, record.description, record.summary, record.category, ...record.tags, ...record.keywords]
            .join(" ")
            .toLowerCase();
    }
}
//# sourceMappingURL=knowledge-record-validator.js.map