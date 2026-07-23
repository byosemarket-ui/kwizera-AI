import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationResourceMetrics } from "./resource-monitor.js";
import { VideoGenerationHealthWarning, MonitoredVideoGenerationModuleHealthScore } from "./types.js";
export declare class VideoGenerationEarlyWarningSystem {
    private readonly foundation;
    constructor(foundation: AiVideoGenerationFoundation);
    detect(moduleScores: MonitoredVideoGenerationModuleHealthScore[], metrics: VideoGenerationResourceMetrics): Promise<VideoGenerationHealthWarning[]>;
    private warn;
}
//# sourceMappingURL=early-warning-system.d.ts.map