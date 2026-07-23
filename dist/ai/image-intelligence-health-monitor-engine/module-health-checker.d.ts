import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceHealthScoreLevel, MonitoredImageIntelligenceModuleHealthScore } from "./types.js";
export declare class ImageIntelligenceModuleHealthChecker {
    private readonly foundation;
    constructor(foundation: AiImageIntelligenceFoundation);
    checkAll(): MonitoredImageIntelligenceModuleHealthScore[];
    scoreToLevel(score: number): ImageIntelligenceHealthScoreLevel;
    private checkModule;
}
//# sourceMappingURL=module-health-checker.d.ts.map