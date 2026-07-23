import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIntelligenceHealthScoreLevel, MonitoredVideoIntelligenceModuleHealthScore } from "./types.js";
export declare class VideoIntelligenceModuleHealthChecker {
    private readonly foundation;
    constructor(foundation: AiVideoIntelligenceFoundation);
    checkAll(): MonitoredVideoIntelligenceModuleHealthScore[];
    scoreToLevel(score: number): VideoIntelligenceHealthScoreLevel;
    private checkModule;
}
//# sourceMappingURL=module-health-checker.d.ts.map