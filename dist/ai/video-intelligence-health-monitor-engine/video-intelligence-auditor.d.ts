import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { VideoIntelligenceAuditResult } from "./types.js";
export declare class VideoIntelligenceAuditor {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, storageRoot: string, logger: VideoIntelligenceHealthMonitorLogger);
    runAudit(): Promise<VideoIntelligenceAuditResult>;
}
//# sourceMappingURL=video-intelligence-auditor.d.ts.map