import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIntelligenceResourceMetrics } from "./resource-monitor.js";
import { VideoIntelligenceHealthWarning, MonitoredVideoIntelligenceModuleHealthScore } from "./types.js";
export declare class VideoIntelligenceEarlyWarningSystem {
    private readonly foundation;
    constructor(foundation: AiVideoIntelligenceFoundation);
    detect(moduleScores: MonitoredVideoIntelligenceModuleHealthScore[], metrics: VideoIntelligenceResourceMetrics): Promise<VideoIntelligenceHealthWarning[]>;
    private warn;
}
//# sourceMappingURL=early-warning-system.d.ts.map