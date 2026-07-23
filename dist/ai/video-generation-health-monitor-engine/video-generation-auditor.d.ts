import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationHealthMonitorLogger } from "./health-logger.js";
import { VideoGenerationAuditResult } from "./types.js";
export declare class VideoGenerationAuditor {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, storageRoot: string, logger: VideoGenerationHealthMonitorLogger);
    runAudit(): Promise<VideoGenerationAuditResult>;
    private validateDependencies;
}
//# sourceMappingURL=video-generation-auditor.d.ts.map