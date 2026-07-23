import { MemoryAccessRequest, MemoryAccessResult } from "./types.js";
import { MemoryFoundationLogger } from "./memory-logger.js";
import { MemoryHistoryStore } from "./memory-history-store.js";
import { MemoryRegistry } from "./memory-registry.js";
import { MemoryStorageManager } from "./memory-storage.js";
export declare class MemoryAccessCoordinator {
    private readonly logger;
    private readonly history;
    private readonly registry;
    private readonly storage;
    private totalRequests;
    private readTimes;
    private writeTimes;
    constructor(logger: MemoryFoundationLogger, history: MemoryHistoryStore, registry: MemoryRegistry, storage: MemoryStorageManager);
    requestAccess(request: MemoryAccessRequest): Promise<MemoryAccessResult>;
    private recordAccess;
    getAverageReadMs(): number;
    getAverageWriteMs(): number;
    getTotalRequests(): number;
    private hasPermission;
}
//# sourceMappingURL=memory-access-coordinator.d.ts.map