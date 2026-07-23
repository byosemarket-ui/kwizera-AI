import { KnowledgeAccessRequest, KnowledgeAccessResult } from "./types.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeHistoryStore } from "./knowledge-history-store.js";
import { KnowledgeRegistry } from "./knowledge-registry.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";
export declare class KnowledgeAccessCoordinator {
    private readonly logger;
    private readonly history;
    private readonly registry;
    private readonly storage;
    private totalRequests;
    private readTimes;
    private writeTimes;
    constructor(logger: KnowledgeFoundationLogger, history: KnowledgeHistoryStore, registry: KnowledgeRegistry, storage: KnowledgeStorageManager);
    requestAccess(request: KnowledgeAccessRequest): Promise<KnowledgeAccessResult>;
    private recordAccess;
    getAverageReadMs(): number;
    getAverageWriteMs(): number;
    getTotalRequests(): number;
    private hasPermission;
}
//# sourceMappingURL=knowledge-access-coordinator.d.ts.map