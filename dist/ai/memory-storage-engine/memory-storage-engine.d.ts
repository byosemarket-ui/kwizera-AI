import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageLogger } from "./storage-logger.js";
import { IntegrityCheckResult, MemoryRecord, MemoryRecordInput, MemoryRecordUpdate, MemoryStorageStatusReport, StorageReadResult, StorageWriteResult } from "./types.js";
import type { MemoryIndexHook } from "./index-hook.js";
/**
 * Memory Storage Engine — permanently stores every important memory record.
 * All writes are validated, versioned, and indexed for future search and learning.
 */
export declare class AiMemoryStorageEngine {
    private foundation;
    private storageRoot;
    private memoryRoot;
    private initialized;
    private startupComplete;
    readonly logger: MemoryStorageLogger;
    private readonly validator;
    private readonly store;
    private readonly index;
    private readonly duplicateDetector;
    private readonly versionManager;
    private integrityChecker;
    private writeTimes;
    private readTimes;
    private lastIntegrity;
    private indexHook;
    initialize(foundation: AiMemoryFoundation, storageRoot: string, memoryRoot: string): void;
    setIndexHook(hook: MemoryIndexHook): void;
    runStartup(): Promise<void>;
    storeRecord(input: MemoryRecordInput, requesterId?: string): Promise<StorageWriteResult>;
    updateRecord(memoryId: string, update: MemoryRecordUpdate, requesterId?: string): Promise<StorageWriteResult>;
    getRecord(memoryId: string, requesterId?: string): Promise<StorageReadResult>;
    searchMetadata(query: string): import("./types.js").MemoryStorageIndexEntry[];
    getIndexEntries(): import("./types.js").MemoryStorageIndexEntry[];
    findIndexEntry(memoryId: string): import("./types.js").MemoryStorageIndexEntry | undefined;
    verifyRecordChecksum(memoryId: string): boolean;
    validateRecordIntegrity(record: MemoryRecord): import("./types.js").StorageValidationResult;
    isStorageAvailable(): boolean;
    runIntegrityCheck(): IntegrityCheckResult;
    getRecordCount(): number;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): MemoryStorageStatusReport;
    private requestFoundationAccess;
    private generateMemoryId;
    private ensureReady;
}
//# sourceMappingURL=memory-storage-engine.d.ts.map