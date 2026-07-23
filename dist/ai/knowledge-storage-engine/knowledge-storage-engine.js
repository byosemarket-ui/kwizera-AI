import crypto from "node:crypto";
import path from "node:path";
import { KnowledgeAccessOperation } from "../knowledge-foundation/types.js";
import { KnowledgeClassifier } from "./knowledge-classifier.js";
import { KnowledgeDuplicateDetector } from "./knowledge-duplicate-detector.js";
import { KnowledgeIntegrityChecker } from "./knowledge-integrity-checker.js";
import { KnowledgeRecordIndex } from "./knowledge-record-index.js";
import { KnowledgeRecordStore } from "./knowledge-record-store.js";
import { KnowledgeRecordValidator } from "./knowledge-record-validator.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";
import { KNOWLEDGE_STORAGE_TYPE_DEFINITIONS, mapStorageTypeToFoundationCategory, } from "./storage-type-config.js";
import { KnowledgeVersionManager } from "./knowledge-version-manager.js";
import { KnowledgeValidationHistoryStore } from "./validation-history-store.js";
import { KnowledgeIntegrityStatus, KnowledgeRecordStatus, KnowledgeStorageEngineError, KnowledgeStorageValidationCode, } from "./types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
/**
 * Knowledge Storage Engine — permanently stores, versions, and protects all knowledge records.
 */
export class AiKnowledgeStorageEngine {
    foundation = null;
    storageRoot = "";
    knowledgeRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new KnowledgeStorageLogger();
    validator = new KnowledgeRecordValidator();
    store = new KnowledgeRecordStore(this.logger);
    index = new KnowledgeRecordIndex(this.logger);
    duplicateDetector = new KnowledgeDuplicateDetector(this.logger, this.validator);
    versionManager = new KnowledgeVersionManager(this.logger);
    classifier = new KnowledgeClassifier();
    validationHistory = new KnowledgeValidationHistoryStore(this.logger);
    integrityChecker = null;
    writeTimes = [];
    readTimes = [];
    lastIntegrity = null;
    onRecordChanged = null;
    initialize(foundation, storageRoot, knowledgeRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.knowledgeRoot = knowledgeRoot;
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.store.initialize(knowledgeRoot);
        this.index.initialize(this.store.getStorageDir());
        this.validationHistory.initialize(this.store.getStorageDir());
        this.integrityChecker = new KnowledgeIntegrityChecker(this.logger, this.validator, this.store, this.index, this.versionManager);
        this.initialized = true;
        this.logger.log("info", "startup", "Knowledge Storage Engine initialized", { knowledgeRoot });
    }
    async runStartup() {
        this.ensureReady();
        if (!this.store.isStorageAvailable()) {
            throw new KnowledgeStorageEngineError("Storage unavailable", "STORAGE_UNAVAILABLE");
        }
        this.lastIntegrity = this.integrityChecker.runFullCheck();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Knowledge Storage Engine startup complete", {
            recordCount: this.index.getRecordCount(),
            types: KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.length,
        });
    }
    async storeRecord(input, requesterId = "knowledge-storage-engine") {
        this.ensureReady();
        const start = Date.now();
        const validation = this.validator.validateInput(input);
        this.recordValidationHistory("create", input.knowledgeId ?? "pending", validation, start, input);
        if (!validation.valid) {
            this.logger.log("warn", "validation", validation.message, { diagnostics: validation.diagnostics });
            return { success: false, validation, durationMs: Date.now() - start };
        }
        if (!this.store.isStorageAvailable()) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: KnowledgeStorageValidationCode.StorageUnavailable,
                    message: "Storage is not available",
                    diagnostics: ["Cannot write — storage directory unavailable"],
                },
                durationMs: Date.now() - start,
            };
        }
        const access = await this.requestFoundationAccess(input.knowledgeType, KnowledgeAccessOperation.Write, requesterId);
        if (!access.granted) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: KnowledgeStorageValidationCode.AccessDenied,
                    message: access.message,
                    diagnostics: [access.message],
                },
                durationMs: Date.now() - start,
            };
        }
        const knowledgeId = input.knowledgeId ?? this.generateKnowledgeId(input.knowledgeType);
        const now = new Date().toISOString();
        const recordPath = this.store.getRecordPath(input.knowledgeType, knowledgeId);
        const classification = this.classifier.classify(input);
        const partialRecord = {
            title: input.title,
            description: input.description,
            summary: input.summary ?? input.description.slice(0, 200),
            tags: input.tags ?? [],
            keywords: input.keywords ?? [],
            payload: input.payload,
        };
        const contentHash = this.validator.computeContentHash(partialRecord);
        const duplicate = this.duplicateDetector.checkDuplicate(this.index.getIndex(), {
            knowledgeId,
            knowledgeType: input.knowledgeType,
            title: input.title,
            source: input.source,
            contentHash,
        });
        if (duplicate.isDuplicate) {
            this.logger.log("warn", "duplicate", duplicate.reason ?? "Duplicate detected", { knowledgeId });
            return {
                success: false,
                validation: {
                    valid: false,
                    code: KnowledgeStorageValidationCode.DuplicateRecord,
                    message: duplicate.reason ?? "Duplicate record",
                    diagnostics: [duplicate.reason ?? "Duplicate"],
                },
                durationMs: Date.now() - start,
            };
        }
        const qualityScore = input.qualityScore ?? 80;
        const confidenceScore = input.confidenceScore ?? 75;
        const verificationStatus = this.validator.resolveVerificationStatus(qualityScore, confidenceScore, input.verificationStatus);
        const record = {
            knowledgeId,
            knowledgeType: input.knowledgeType,
            category: input.category,
            title: input.title,
            description: input.description,
            summary: input.summary ?? input.description.slice(0, 200),
            tags: input.tags ?? [],
            keywords: input.keywords ?? [],
            source: input.source,
            sourceReliability: input.sourceReliability ?? 75,
            confidenceScore,
            qualityScore,
            verificationStatus,
            relatedMemory: input.relatedMemory ?? [],
            relatedKnowledge: input.relatedKnowledge ?? [],
            version: 1,
            creationDate: now,
            lastUpdated: now,
            status: this.validator.resolveRecordStatus(verificationStatus, input.status),
            storageLocation: recordPath,
            integrityStatus: KnowledgeIntegrityStatus.PendingVerification,
            contentHash,
            searchableText: this.validator.buildSearchableText({
                title: input.title,
                description: input.description,
                summary: input.summary ?? input.description.slice(0, 200),
                tags: input.tags ?? [],
                keywords: input.keywords ?? [],
                category: input.category,
            }),
            classification,
            payload: input.payload,
        };
        const writeMs = this.store.writeRecord(recordPath, record);
        this.writeTimes.push(writeMs);
        record.integrityStatus = this.integrityChecker.verifySingleRecord(record)
            ? KnowledgeIntegrityStatus.Verified
            : KnowledgeIntegrityStatus.Unverified;
        this.store.writeRecord(recordPath, record);
        this.versionManager.saveVersion(record, recordPath, "Initial knowledge record created");
        this.index.upsert(this.duplicateDetector.buildIndexEntry(record));
        this.logger.log("info", "create", "Knowledge record stored", {
            knowledgeId,
            knowledgeType: input.knowledgeType,
            classification: record.classification.topic,
            writeMs,
        });
        this.onRecordChanged?.(knowledgeId, "create");
        return {
            success: true,
            record,
            validation,
            durationMs: Date.now() - start,
            version: 1,
        };
    }
    async updateRecord(knowledgeId, update, requesterId = "knowledge-storage-engine") {
        this.ensureReady();
        const start = Date.now();
        const validation = this.validator.validateUpdate(update);
        if (!validation.valid) {
            return { success: false, validation, durationMs: Date.now() - start };
        }
        const indexEntry = this.index.findById(knowledgeId);
        if (!indexEntry) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: KnowledgeStorageValidationCode.InvalidData,
                    message: `Record not found: ${knowledgeId}`,
                    diagnostics: [`No record with ID ${knowledgeId}`],
                },
                durationMs: Date.now() - start,
            };
        }
        const access = await this.requestFoundationAccess(indexEntry.knowledgeType, KnowledgeAccessOperation.Update, requesterId);
        if (!access.granted) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: KnowledgeStorageValidationCode.AccessDenied,
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
                    code: KnowledgeStorageValidationCode.CorruptedRecord,
                    message: "Existing record unreadable",
                    diagnostics: ["Record file missing or corrupted"],
                },
                durationMs: Date.now() - start,
            };
        }
        this.versionManager.archiveBeforeUpdate(existing, existing.storageLocation);
        const now = new Date().toISOString();
        const qualityScore = update.qualityScore ?? existing.qualityScore;
        const confidenceScore = update.confidenceScore ?? existing.confidenceScore;
        const verificationStatus = this.validator.resolveVerificationStatus(qualityScore, confidenceScore, update.verificationStatus ?? existing.verificationStatus);
        const updated = {
            ...existing,
            ...update,
            summary: update.summary ?? existing.summary,
            tags: update.tags ?? existing.tags,
            keywords: update.keywords ?? existing.keywords,
            relatedMemory: update.relatedMemory ?? existing.relatedMemory,
            relatedKnowledge: update.relatedKnowledge ?? existing.relatedKnowledge,
            qualityScore,
            confidenceScore,
            verificationStatus,
            lastUpdated: now,
            version: existing.version + 1,
            status: this.validator.resolveRecordStatus(verificationStatus, update.status ?? existing.status),
        };
        updated.contentHash = this.validator.computeContentHash(updated);
        updated.searchableText = this.validator.buildSearchableText(updated);
        updated.classification = this.classifier.reclassify(updated);
        updated.integrityStatus = KnowledgeIntegrityStatus.PendingVerification;
        const writeMs = this.store.writeRecord(updated.storageLocation, updated);
        this.writeTimes.push(writeMs);
        updated.integrityStatus = this.integrityChecker.verifySingleRecord(updated)
            ? KnowledgeIntegrityStatus.Verified
            : KnowledgeIntegrityStatus.Unverified;
        this.store.writeRecord(updated.storageLocation, updated);
        this.versionManager.saveVersion(updated, updated.storageLocation, `Updated to version ${updated.version}`);
        this.index.upsert(this.duplicateDetector.buildIndexEntry(updated));
        this.recordValidationHistory("update", knowledgeId, validation, start, undefined, updated);
        this.logger.log("info", "update", "Knowledge record updated", {
            knowledgeId,
            version: updated.version,
            writeMs,
        });
        this.onRecordChanged?.(knowledgeId, "update");
        return {
            success: true,
            record: updated,
            validation,
            durationMs: Date.now() - start,
            version: updated.version,
        };
    }
    async getRecord(knowledgeId, requesterId = "knowledge-storage-engine") {
        this.ensureReady();
        const start = Date.now();
        const indexEntry = this.index.findById(knowledgeId);
        if (!indexEntry) {
            return { success: false, durationMs: Date.now() - start, message: `Record not found: ${knowledgeId}` };
        }
        const access = await this.requestFoundationAccess(indexEntry.knowledgeType, KnowledgeAccessOperation.Read, requesterId);
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
    async rollbackToVersion(knowledgeId, version, requesterId = "knowledge-storage-engine") {
        this.ensureReady();
        const start = Date.now();
        const indexEntry = this.index.findById(knowledgeId);
        if (!indexEntry) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: KnowledgeStorageValidationCode.InvalidData,
                    message: `Record not found: ${knowledgeId}`,
                    diagnostics: [],
                },
                durationMs: Date.now() - start,
            };
        }
        const historical = this.versionManager.getVersion(indexEntry.storageLocation, version);
        if (!historical) {
            return {
                success: false,
                validation: {
                    valid: false,
                    code: KnowledgeStorageValidationCode.InvalidData,
                    message: `Version ${version} not found`,
                    diagnostics: [],
                },
                durationMs: Date.now() - start,
            };
        }
        const { data: current } = this.store.readRecord(indexEntry.storageLocation);
        if (current) {
            this.versionManager.archiveBeforeUpdate(current, current.storageLocation);
        }
        const restored = {
            ...historical,
            version: (current?.version ?? historical.version) + 1,
            lastUpdated: new Date().toISOString(),
        };
        restored.contentHash = this.validator.computeContentHash(restored);
        restored.searchableText = this.validator.buildSearchableText(restored);
        restored.classification = this.classifier.reclassify(restored);
        const writeMs = this.store.writeRecord(restored.storageLocation, restored);
        this.writeTimes.push(writeMs);
        this.versionManager.saveVersion(restored, restored.storageLocation, `Rolled back from v${version}`);
        this.index.upsert(this.duplicateDetector.buildIndexEntry(restored));
        this.logger.log("info", "rollback", "Knowledge record rolled back", { knowledgeId, fromVersion: version });
        return {
            success: true,
            record: restored,
            durationMs: Date.now() - start,
            version: restored.version,
        };
    }
    listVersions(knowledgeId) {
        this.ensureReady();
        const indexEntry = this.index.findById(knowledgeId);
        if (!indexEntry)
            return [];
        return this.versionManager.listVersions(indexEntry.storageLocation);
    }
    searchMetadata(query) {
        return this.index.searchMetadata(query);
    }
    searchByCategory(category) {
        return this.index.findByCategory(category);
    }
    getIndexEntries() {
        return this.index.getIndex().entries;
    }
    findIndexEntry(knowledgeId) {
        return this.index.findById(knowledgeId);
    }
    verifyRecordChecksum(knowledgeId) {
        this.ensureReady();
        const entry = this.index.findById(knowledgeId);
        if (!entry)
            return false;
        return this.store.verifyRecordChecksum(entry.storageLocation);
    }
    validateRecordIntegrity(record) {
        return this.validator.validateRecordIntegrity(record);
    }
    async quarantineUnreadableRecord(knowledgeId, requesterId = "knowledge-storage-engine") {
        this.ensureReady();
        const indexEntry = this.index.findById(knowledgeId);
        if (!indexEntry)
            return false;
        const access = await this.requestFoundationAccess(indexEntry.knowledgeType, KnowledgeAccessOperation.Update, requesterId);
        if (!access.granted)
            return false;
        const now = new Date().toISOString();
        const record = {
            knowledgeId: indexEntry.knowledgeId,
            knowledgeType: indexEntry.knowledgeType,
            category: indexEntry.category,
            title: indexEntry.title || `Quarantined ${knowledgeId}`,
            description: "Record quarantined due to corruption or unreadable storage.",
            summary: "Quarantined corrupt record",
            tags: ["quarantined", "corrupt-repair"],
            keywords: [],
            source: indexEntry.source,
            sourceReliability: 0,
            confidenceScore: 0,
            qualityScore: 0,
            verificationStatus: KnowledgeVerificationStatus.Rejected,
            relatedMemory: [],
            relatedKnowledge: [],
            version: indexEntry.version + 1,
            creationDate: indexEntry.lastUpdated,
            lastUpdated: now,
            status: KnowledgeRecordStatus.Rejected,
            storageLocation: indexEntry.storageLocation,
            integrityStatus: KnowledgeIntegrityStatus.PendingVerification,
            contentHash: "",
            searchableText: indexEntry.searchableText,
            classification: this.classifier.classify({
                knowledgeType: indexEntry.knowledgeType,
                category: indexEntry.category,
                title: indexEntry.title,
                description: "Quarantined corrupt record",
                tags: ["quarantined"],
                qualityScore: 0,
                sourceReliability: 0,
            }),
        };
        record.contentHash = this.validator.computeContentHash(record);
        record.searchableText = this.validator.buildSearchableText(record);
        this.store.writeRecord(indexEntry.storageLocation, record);
        record.integrityStatus = this.integrityChecker.verifySingleRecord(record)
            ? KnowledgeIntegrityStatus.Verified
            : KnowledgeIntegrityStatus.Unverified;
        this.store.writeRecord(indexEntry.storageLocation, record);
        this.index.upsert(this.duplicateDetector.buildIndexEntry(record));
        this.runIntegrityCheck();
        this.logger.log("warn", "integrity", "Unreadable knowledge record quarantined", { knowledgeId });
        return true;
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
    setRecordChangeHandler(handler) {
        this.onRecordChanged = handler;
    }
    getValidationHistoryCount() {
        return this.validationHistory.getCount();
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
            classificationStatus: "automatic classification active",
            recordCount: this.index.getRecordCount(),
            supportedTypes: KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.length,
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
            validationHistoryCount: this.validationHistory.getCount(),
            knownIssues,
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    recordValidationHistory(operation, knowledgeId, validation, start, input, record) {
        this.validationHistory.append({
            timestamp: new Date().toISOString(),
            knowledgeId: record?.knowledgeId ?? knowledgeId,
            operation,
            valid: validation.valid,
            qualityScore: record?.qualityScore ?? input?.qualityScore ?? 0,
            confidenceScore: record?.confidenceScore ?? input?.confidenceScore ?? 0,
            verificationStatus: record?.verificationStatus ?? input?.verificationStatus ?? KnowledgeVerificationStatus.Pending,
            diagnostics: validation.diagnostics,
            durationMs: Date.now() - start,
        });
    }
    async requestFoundationAccess(knowledgeType, operation, requesterId) {
        const category = mapStorageTypeToFoundationCategory(knowledgeType);
        return this.foundation.requestAccess({
            requesterId,
            category,
            operation,
        });
    }
    generateKnowledgeId(knowledgeType) {
        const suffix = crypto.randomBytes(8).toString("hex");
        return `${knowledgeType}-${Date.now()}-${suffix}`;
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new KnowledgeStorageEngineError("Knowledge Storage Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=knowledge-storage-engine.js.map