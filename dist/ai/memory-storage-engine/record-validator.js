import crypto from "node:crypto";
import { StorageValidationCode, } from "./types.js";
const REQUIRED_FIELDS = [
    "memoryType",
    "category",
    "title",
    "description",
    "source",
];
export class RecordValidator {
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
        if (input.payload !== undefined && typeof input.payload !== "object") {
            diagnostics.push("Payload must be a valid object");
        }
        if (diagnostics.length > 0) {
            return {
                valid: false,
                code: diagnostics.some((d) => d.startsWith("Missing"))
                    ? StorageValidationCode.MissingRequiredField
                    : StorageValidationCode.InvalidData,
                message: "Record validation failed",
                diagnostics,
            };
        }
        return { valid: true, message: "Record input valid", diagnostics: [] };
    }
    validateUpdate(update) {
        const diagnostics = [];
        if (update.title !== undefined && update.title.trim() === "") {
            diagnostics.push("Title cannot be empty");
        }
        if (update.qualityScore !== undefined && (update.qualityScore < 0 || update.qualityScore > 100)) {
            diagnostics.push("Quality score must be between 0 and 100");
        }
        if (diagnostics.length > 0) {
            return {
                valid: false,
                code: StorageValidationCode.InvalidData,
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
        if (!record.memoryId || !record.storageLocation) {
            diagnostics.push("Record missing identity or storage location");
        }
        if (diagnostics.length > 0) {
            return {
                valid: false,
                code: StorageValidationCode.CorruptedRecord,
                message: "Record integrity check failed",
                diagnostics,
            };
        }
        return { valid: true, message: "Record integrity verified", diagnostics: [] };
    }
    computeContentHash(record) {
        const content = JSON.stringify({
            title: record.title,
            description: record.description,
            tags: record.tags,
            keywords: record.keywords,
            payload: record.payload ?? {},
        });
        return crypto.createHash("sha256").update(content).digest("hex");
    }
    computeFingerprint(memoryType, title, source, contentHash) {
        return crypto
            .createHash("sha256")
            .update(`${memoryType}:${title.toLowerCase()}:${source}:${contentHash}`)
            .digest("hex")
            .slice(0, 16);
    }
    buildSearchableText(record) {
        return [record.title, record.description, record.category, ...record.tags, ...record.keywords]
            .join(" ")
            .toLowerCase();
    }
}
//# sourceMappingURL=record-validator.js.map