import { KnowledgeRecord, KnowledgeStorageVersionEntry } from "./types.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";
export declare class KnowledgeVersionManager {
    private readonly logger;
    private totalVersions;
    constructor(logger: KnowledgeStorageLogger);
    getVersionsDir(recordStorageLocation: string): string;
    saveVersion(record: KnowledgeRecord, recordStorageLocation: string, changeSummary: string): KnowledgeStorageVersionEntry;
    archiveBeforeUpdate(existing: KnowledgeRecord, recordStorageLocation: string): void;
    listVersions(recordStorageLocation: string): KnowledgeStorageVersionEntry[];
    getVersion(recordStorageLocation: string, version: number): KnowledgeRecord | null;
    getTotalVersions(): number;
}
//# sourceMappingURL=knowledge-version-manager.d.ts.map