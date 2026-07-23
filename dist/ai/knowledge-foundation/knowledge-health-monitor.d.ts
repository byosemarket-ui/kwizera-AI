import { KnowledgeHealthReport, KnowledgeModuleRegistration } from "./types.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeAccessCoordinator } from "./knowledge-access-coordinator.js";
import { KnowledgeRegistry } from "./knowledge-registry.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";
export declare class KnowledgeHealthMonitor {
    private readonly logger;
    private lastReport;
    constructor(logger: KnowledgeFoundationLogger);
    runHealthCheck(storage: KnowledgeStorageManager, registry: KnowledgeRegistry, access: KnowledgeAccessCoordinator, integrationReady: boolean): Promise<KnowledgeHealthReport>;
    getLastReport(): KnowledgeHealthReport | null;
    verifyRegistryHealth(modules: KnowledgeModuleRegistration[]): boolean;
    private scoreToLevel;
    verifyLogDirectory(logDir: string): boolean;
    verifyStorageWritable(knowledgeRoot: string): boolean;
}
//# sourceMappingURL=knowledge-health-monitor.d.ts.map