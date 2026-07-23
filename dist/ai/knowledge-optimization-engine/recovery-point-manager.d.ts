import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeRecoveryPoint } from "./types.js";
export declare class KnowledgeRecoveryPointManager {
    private readonly foundation;
    private readonly logger;
    private recoveryDir;
    private points;
    constructor(foundation: AiKnowledgeFoundation, logger: KnowledgeOptimizationLogger);
    initialize(optimizationDir: string): void;
    createRecoveryPoint(label: string, filesToSnapshot: string[]): KnowledgeRecoveryPoint;
    restore(recoveryPointId: string, targetFiles: Map<string, string>): boolean;
    getLatest(): KnowledgeRecoveryPoint | undefined;
    list(): KnowledgeRecoveryPoint[];
    private persistManifest;
}
//# sourceMappingURL=recovery-point-manager.d.ts.map