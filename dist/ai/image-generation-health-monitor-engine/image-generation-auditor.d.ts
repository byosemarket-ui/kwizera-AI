import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationHealthMonitorLogger } from "./health-logger.js";
import { ImageGenerationAuditResult } from "./types.js";
export declare class ImageGenerationAuditor {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, storageRoot: string, logger: ImageGenerationHealthMonitorLogger);
    runAudit(): Promise<ImageGenerationAuditResult>;
    private validateDependencies;
}
//# sourceMappingURL=image-generation-auditor.d.ts.map