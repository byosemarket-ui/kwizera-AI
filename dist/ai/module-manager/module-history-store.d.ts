import { ModuleHistoryEvent, ModulePerformanceStats } from "./types.js";
export declare class ModuleHistoryStore {
    private historyPath;
    private readonly events;
    private readonly performance;
    initialize(modulesDirectory: string): void;
    appendEvent(event: ModuleHistoryEvent): void;
    appendPerformance(stats: ModulePerformanceStats): void;
    getEvents(): ReadonlyArray<ModuleHistoryEvent>;
    getPerformance(): ReadonlyArray<ModulePerformanceStats>;
    getHistoryPath(): string | null;
}
//# sourceMappingURL=module-history-store.d.ts.map