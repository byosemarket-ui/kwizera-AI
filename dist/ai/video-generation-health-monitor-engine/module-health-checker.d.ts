import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationHealthScoreLevel, MonitoredVideoGenerationModuleHealthScore } from "./types.js";
export declare class VideoGenerationModuleHealthChecker {
    private readonly foundation;
    constructor(foundation: AiVideoGenerationFoundation);
    checkAll(): MonitoredVideoGenerationModuleHealthScore[];
    scoreToLevel(score: number): VideoGenerationHealthScoreLevel;
    private checkModule;
}
//# sourceMappingURL=module-health-checker.d.ts.map