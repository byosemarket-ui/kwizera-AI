import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";
import { KnowledgeIntegrityCheckResult, KnowledgeRecord, KnowledgeRecordInput, KnowledgeRecordUpdate, KnowledgeStorageReadResult, KnowledgeStorageStatusReport, KnowledgeStorageWriteResult, KnowledgeStorageVersionEntry } from "./types.js";
/**
 * Knowledge Storage Engine — permanently stores, versions, and protects all knowledge records.
 */
export declare class AiKnowledgeStorageEngine {
    private foundation;
    private storageRoot;
    private knowledgeRoot;
    private initialized;
    private startupComplete;
    readonly logger: KnowledgeStorageLogger;
    private readonly validator;
    private readonly store;
    private readonly index;
    private readonly duplicateDetector;
    private readonly versionManager;
    private readonly classifier;
    private readonly validationHistory;
    private integrityChecker;
    private writeTimes;
    private readTimes;
    private lastIntegrity;
    private onRecordChanged;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string, knowledgeRoot: string): void;
    runStartup(): Promise<void>;
    storeRecord(input: KnowledgeRecordInput, requesterId?: string): Promise<KnowledgeStorageWriteResult>;
    updateRecord(knowledgeId: string, update: KnowledgeRecordUpdate, requesterId?: string): Promise<KnowledgeStorageWriteResult>;
    getRecord(knowledgeId: string, requesterId?: string): Promise<KnowledgeStorageReadResult>;
    rollbackToVersion(knowledgeId: string, version: number, requesterId?: string): Promise<KnowledgeStorageWriteResult>;
    listVersions(knowledgeId: string): KnowledgeStorageVersionEntry[];
    searchMetadata(query: string): import("./types.js").KnowledgeStorageIndexEntry[];
    searchByCategory(category: string): import("./types.js").KnowledgeStorageIndexEntry[];
    getIndexEntries(): import("./types.js").KnowledgeStorageIndexEntry[];
    findIndexEntry(knowledgeId: string): import("./types.js").KnowledgeStorageIndexEntry | undefined;
    verifyRecordChecksum(knowledgeId: string): boolean;
    validateRecordIntegrity(record: KnowledgeRecord): import("./types.js").KnowledgeStorageValidationResult;
    quarantineUnreadableRecord(knowledgeId: string, requesterId?: string): Promise<boolean>;
    isStorageAvailable(): boolean;
    runIntegrityCheck(): KnowledgeIntegrityCheckResult;
    getRecordCount(): number;
    setRecordChangeHandler(handler: ((knowledgeId: string, operation: "create" | "update") => void) | null): void;
    getValidationHistoryCount(): number;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): KnowledgeStorageStatusReport;
    private recordValidationHistory;
    private requestFoundationAccess;
    private generateKnowledgeId;
    private ensureReady;
}
//# sourceMappingURL=knowledge-storage-engine.d.ts.map