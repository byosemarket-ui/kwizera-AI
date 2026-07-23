import type { AiCoreManager } from "../core/ai-core-manager.js";
import { ModuleManagerLogger } from "./module-logger.js";
import { CommunicationRequest, CommunicationResponse, ModuleCommunicationRecord, ModuleRegistryRecord } from "./types.js";
export declare class ModuleCommunicationRouter {
    private readonly getRecord;
    private readonly logger;
    private readonly records;
    private readonly isolatedModules;
    constructor(getRecord: (id: string) => ModuleRegistryRecord | undefined, logger: ModuleManagerLogger);
    isolate(moduleId: string): void;
    clearIsolation(moduleId: string): void;
    isIsolated(moduleId: string): boolean;
    route(core: AiCoreManager, request: CommunicationRequest, handler?: (payload: Record<string, unknown> | undefined) => Promise<unknown>): Promise<CommunicationResponse>;
    getRecords(): ReadonlyArray<ModuleCommunicationRecord>;
}
//# sourceMappingURL=communication-router.d.ts.map