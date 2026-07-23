import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ImageIntelligenceAuditResult } from "./types.js";
export declare class ImageIntelligenceAuditor {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, storageRoot: string, logger: ImageIntelligenceHealthMonitorLogger);
    runAudit(): Promise<ImageIntelligenceAuditResult>;
}
//# sourceMappingURL=image-intelligence-auditor.d.ts.map