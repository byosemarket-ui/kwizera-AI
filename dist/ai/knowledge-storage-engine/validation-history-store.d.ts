import { KnowledgeValidationHistoryEntry } from "./types.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";
export declare class KnowledgeValidationHistoryStore {
    private readonly logger;
    private historyPath;
    private entries;
    constructor(logger: KnowledgeStorageLogger);
    initialize(storageDir: string): void;
    append(entry: KnowledgeValidationHistoryEntry): void;
    getAll(): KnowledgeValidationHistoryEntry[];
    getCount(): number;
}
//# sourceMappingURL=validation-history-store.d.ts.map