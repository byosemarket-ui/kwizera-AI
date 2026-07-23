import { RecoveryEngineLogger } from "./recovery-logger.js";
import { ProjectRecoveryContext } from "./types.js";
export declare class ProjectRecovery {
    private readonly logger;
    constructor(logger: RecoveryEngineLogger);
    buildRecoveryContext(projectId: string, metadata?: Record<string, unknown>): ProjectRecoveryContext;
    restoreFromState(projects: Record<string, {
        id: string;
        state: string;
        metadata?: Record<string, unknown>;
    }>): ProjectRecoveryContext[];
}
//# sourceMappingURL=project-recovery.d.ts.map