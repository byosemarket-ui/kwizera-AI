import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeHealthMonitorLogger } from "./health-logger.js";
import { KnowledgeAuditResult } from "./types.js";
export declare class KnowledgeAuditor {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, storageRoot: string, logger: KnowledgeHealthMonitorLogger);
    runAudit(): Promise<KnowledgeAuditResult>;
}
//# sourceMappingURL=knowledge-auditor.d.ts.map