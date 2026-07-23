import crypto from "node:crypto";
import path from "node:path";
import { MemoryAccessOperation } from "../memory-foundation/types.js";
import { mapStorageTypeToFoundationCategory } from "./storage-type-config.js";
import { DuplicateDetector } from "./duplicate-detector.js";
import { IntegrityChecker } from "./integrity-checker.js";
import { RecordIndex } from "./record-index.js";
import { RecordStore } from "./record-store.js";
import { RecordValidator } from "./record-validator.js";
import { MemoryStorageLogger } from "./storage-logger.js";
import { STORAGE_TYPE_DEFINITIONS } from "./storage-type-config.js";
import { VersionManager } from "./version-manager.js";
import { MemoryIntegrityStatus, MemoryRecordStatus, MemoryStorageEngineError, StorageValidationCode, } from "./types.js";
/**
 * Memory Storage Engine — permanently stores every important memory record.
 * All writes are validated, versioned, and indexed for future search and learning.
 */
export class AiMemoryStorageEngine {
    foundation = null;
    storageRoot = "";
    memoryRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new MemoryStorageLogger();
    validator = new RecordValidator();
    store = new RecordStore(this.logger);
    index = new RecordIndex(this.logger);
    duplicateDetector = new DuplicateDetector(this.logger, this.validator);
    versionManager = new VersionManager(this.logger);
    integrityChecker = null;
    writeTimes = [];
    readTimes = [];
    lastIntegrity = null;
    indexHook = null;
    initialize(foundation, storageRoot, memoryRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.memoryRoot = memoryRoot;
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.store.initialize(memoryRoot);
        this.index.initialize(this.store.getStorageDir());
        this.integrityChecker = new IntegrityChecker(this.logger, this.validator, this.store, this.index);
        this.initialized = true;
        this.logger.log("info", "startup", "Memory Storage Engine initialized", { memoryRoot });
    }
    setIndexHook(hook) {
        this.indexHook = hook;
    }
    async runStartup() {
        this.ensureReady();
        if (!this.store.isStorageAvailable()) {
            throw new MemoryStorageEngineError("Storage unavailable", "STORAGE_UNAVAILABLE");
        }
        this.lastIntegrity = this.integrityChecker.runFullCheck();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Memory Storage Engine startup complete", {
            recordCount: this.index.getRecordCount(),
            types: STORAGE_TYPE_DEFINITIONS.length,
        });
    }
    async storeRecord(input, requesterId = "memory-storage-engine") {
        this.ensureReady();
        const start = Date.now();
        const validation = this.validator.validateInput(input);
        if (!validation.valid) {
            this.logger.log("warn", "validation", validation.message, { diagnostics: validation.diagnostics });
            return { success: false, validation, durationMs: Date.now() - start };
        }
        if (!this.store.isStorageAvailable()) {
            const unavailable = {
                success: false,
                validation: {
                    valid: false,
                    code: StorageValidationCode.StorageUnavailable,
                    message: "Storage is not available",
                    diagnostics: ["Cannot write — storage directory unavailable"],
                },
                durationMs: Date.now() - start,
            };
            return unavailable;
        }
        const access = await this.requestFoundationAccess(input.memoryType, MemoryAccessOperation.Write, requesterId);
        if (!access.granted) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: StorageValidationCode.AccessDenied,
                    message: access.message,
                    diagnostics: [access.message],
                },
                durationMs: Date.now() - start,
            };
        }
        const memoryId = input.memoryId ?? this.generateMemoryId(input.memoryType);
        const now = new Date().toISOString();
        const recordPath = this.store.getRecordPath(input.memoryType, memoryId);
        const partialRecord = {
            title: input.title,
            description: input.description,
            tags: input.tags ?? [],
            keywords: input.keywords ?? [],
            payload: input.payload,
        };
        const contentHash = this.validator.computeContentHash(partialRecord);
        const duplicate = this.duplicateDetector.checkDuplicate(this.index.getIndex(), {
            memoryId,
            memoryType: input.memoryType,
            title: input.title,
            source: input.source,
            contentHash,
        });
        if (duplicate.isDuplicate) {
            this.logger.log("warn", "duplicate", duplicate.reason ?? "Duplicate detected", { memoryId });
            return {
                success: false,
                validation: {
                    valid: false,
                    code: StorageValidationCode.DuplicateRecord,
                    message: duplicate.reason ?? "Duplicate record",
                    diagnostics: [duplicate.reason ?? "Duplicate"],
                },
                durationMs: Date.now() - start,
            };
        }
        const record = {
            memoryId,
            memoryType: input.memoryType,
            category: input.category,
            title: input.title,
            description: input.description,
            tags: input.tags ?? [],
            keywords: input.keywords ?? [],
            creationTime: now,
            lastUpdate: now,
            source: input.source,
            relatedProject: input.relatedProject,
            relatedWorkflow: input.relatedWorkflow,
            relatedFiles: input.relatedFiles ?? [],
            qualityScore: input.qualityScore ?? 80,
            status: input.status ?? MemoryRecordStatus.Active,
            version: 1,
            storageLocation: recordPath,
            integrityStatus: MemoryIntegrityStatus.PendingVerification,
            contentHash,
            searchableText: this.validator.buildSearchableText({
                title: input.title,
                description: input.description,
                tags: input.tags ?? [],
                keywords: input.keywords ?? [],
                category: input.category,
            }),
            payload: input.payload,
        };
        const writeMs = this.store.writeRecord(recordPath, record);
        this.writeTimes.push(writeMs);
        record.integrityStatus = this.integrityChecker.verifySingleRecord(record)
            ? MemoryIntegrityStatus.Verified
            : MemoryIntegrityStatus.Unverified;
        this.store.writeRecord(recordPath, record);
        this.versionManager.saveVersion(record, recordPath);
        const indexEntry = this.duplicateDetector.buildIndexEntry(record);
        this.index.upsert(indexEntry);
        this.logger.log("info", "create", "Memory record stored", {
            memoryId,
            memoryType: input.memoryType,
            writeMs,
        });
        this.indexHook?.onRecordStored(record);
        return {
            success: true,
            record,
            validation,
            durationMs: Date.now() - start,
            version: 1,
        };
    }
    async updateRecord(memoryId, update, requesterId = "memory-storage-engine") {
        this.ensureReady();
        const start = Date.now();
        const validation = this.validator.validateUpdate(update);
        if (!validation.valid) {
            return { success: false, validation, durationMs: Date.now() - start };
        }
        const indexEntry = this.index.findById(memoryId);
        if (!indexEntry) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: StorageValidationCode.InvalidData,
                    message: `Record not found: ${memoryId}`,
                    diagnostics: [`No record with ID ${memoryId}`],
                },
                durationMs: Date.now() - start,
            };
        }
        const access = await this.requestFoundationAccess(indexEntry.memoryType, MemoryAccessOperation.Update, requesterId);
        if (!access.granted) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: StorageValidationCode.AccessDenied,
                    message: access.message,
                    diagnostics: [access.message],
                },
                durationMs: Date.now() - start,
            };
        }
        const { data: existing } = this.store.readRecord(indexEntry.storageLocation);
        if (!existing) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: StorageValidationCode.CorruptedRecord,
                    message: "Existing record unreadable",
                    diagnostics: ["Record file missing or corrupted"],
                },
                durationMs: Date.now() - start,
            };
        }
        this.versionManager.archiveBeforeUpdate(existing, existing.storageLocation);
        const now = new Date().toISOString();
        const updated = {
            ...existing,
            ...update,
            tags: update.tags ?? existing.tags,
            keywords: update.keywords ?? existing.keywords,
            relatedFiles: update.relatedFiles ?? existing.relatedFiles,
            lastUpdate: now,
            version: existing.version + 1,
        };
        updated.contentHash = this.validator.computeContentHash(updated);
        updated.searchableText = this.validator.buildSearchableText(updated);
        updated.integrityStatus = MemoryIntegrityStatus.PendingVerification;
        const writeMs = this.store.writeRecord(updated.storageLocation, updated);
        this.writeTimes.push(writeMs);
        updated.integrityStatus = this.integrityChecker.verifySingleRecord(updated)
            ? MemoryIntegrityStatus.Verified
            : MemoryIntegrityStatus.Unverified;
        this.store.writeRecord(updated.storageLocation, updated);
        this.versionManager.saveVersion(updated, updated.storageLocation);
        this.index.upsert(this.duplicateDetector.buildIndexEntry(updated));
        this.logger.log("info", "update", "Memory record updated", {
            memoryId,
            version: updated.version,
            writeMs,
        });
        if (updated.status === MemoryRecordStatus.Deleted) {
            this.indexHook?.onRecordRemoved(memoryId);
        }
        else {
            this.indexHook?.onRecordUpdated(updated);
        }
        return {
            success: true,
            record: updated,
            validation,
            durationMs: Date.now() - start,
            version: updated.version,
        };
    }
    async getRecord(memoryId, requesterId = "memory-storage-engine") {
        this.ensureReady();
        const start = Date.now();
        const indexEntry = this.index.findById(memoryId);
        if (!indexEntry) {
            return { success: false, durationMs: Date.now() - start, message: `Record not found: ${memoryId}` };
        }
        const access = await this.requestFoundationAccess(indexEntry.memoryType, MemoryAccessOperation.Read, requesterId);
        if (!access.granted) {
            return { success: false, durationMs: Date.now() - start, message: access.message };
        }
        const { data, durationMs } = this.store.readRecord(indexEntry.storageLocation);
        this.readTimes.push(durationMs);
        if (!data) {
            return { success: false, durationMs: Date.now() - start, message: "Record file missing" };
        }
        return { success: true, record: data, durationMs: Date.now() - start };
    }
    searchMetadata(query) {
        return this.index.searchMetadata(query);
    }
    getIndexEntries() {
        return this.index.getIndex().entries;
    }
    findIndexEntry(memoryId) {
        return this.index.findById(memoryId);
    }
    verifyRecordChecksum(memoryId) {
        this.ensureReady();
        const entry = this.index.findById(memoryId);
        if (!entry)
            return false;
        return this.store.verifyRecordChecksum(entry.storageLocation);
    }
    validateRecordIntegrity(record) {
        return this.validator.validateRecordIntegrity(record);
    }
    isStorageAvailable() {
        return this.store.isStorageAvailable();
    }
    runIntegrityCheck() {
        this.ensureReady();
        this.lastIntegrity = this.integrityChecker.runFullCheck();
        return this.lastIntegrity;
    }
    getRecordCount() {
        return this.index.getRecordCount();
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const knownIssues = [];
        if (this.lastIntegrity && !this.lastIntegrity.verified) {
            knownIssues.push(...this.lastIntegrity.issues);
        }
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.store.isStorageAvailable())
            readinessScore -= 30;
        if (this.lastIntegrity && !this.lastIntegrity.verified)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            storageStatus: this.store.isStorageAvailable() ? "available" : "unavailable",
            validationStatus: "write validation active",
            integrityStatus: this.lastIntegrity?.verified ? "verified" : "issues detected",
            recordCount: this.index.getRecordCount(),
            supportedTypes: STORAGE_TYPE_DEFINITIONS.length,
            performance: {
                averageWriteMs: avg(this.writeTimes),
                averageReadMs: avg(this.readTimes),
                lastWriteMs: this.writeTimes[this.writeTimes.length - 1] ?? 0,
                lastReadMs: this.readTimes[this.readTimes.length - 1] ?? 0,
                indexSize: this.index.getRecordCount(),
            },
            versionManagement: {
                enabled: true,
                totalVersions: this.versionManager.getTotalVersions(),
            },
            backupReady: true,
            knownIssues,
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    async requestFoundationAccess(memoryType, operation, requesterId) {
        const category = mapStorageTypeToFoundationCategory(memoryType);
        return this.foundation.requestAccess({
            requesterId,
            category,
            operation,
        });
    }
    generateMemoryId(memoryType) {
        const suffix = crypto.randomBytes(8).toString("hex");
        return `${memoryType}-${Date.now()}-${suffix}`;
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new MemoryStorageEngineError("Memory Storage Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=memory-storage-engine.js.map