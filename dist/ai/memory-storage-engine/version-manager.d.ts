import { MemoryRecord, MemoryVersionEntry } from "./types.js";
import { MemoryStorageLogger } from "./storage-logger.js";
export declare class VersionManager {
    private readonly logger;
    private totalVersions;
    constructor(logger: MemoryStorageLogger);
    getRecordDir(recordStorageLocation: string): string;
    getVersionsDir(recordStorageLocation: string): string;
    getCurrentPath(recordStorageLocation: string): string;
    saveVersion(record: MemoryRecord, recordStorageLocation: string): MemoryVersionEntry;
    archiveBeforeUpdate(existing: MemoryRecord, recordStorageLocation: string): void;
    listVersions(recordStorageLocation: string): MemoryVersionEntry[];
    getVersion(recordStorageLocation: string, version: number): MemoryRecord | null;
    getTotalVersions(): number;
}
//# sourceMappingURL=version-manager.d.ts.map