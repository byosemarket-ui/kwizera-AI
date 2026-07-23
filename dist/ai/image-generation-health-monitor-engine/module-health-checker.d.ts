import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationHealthScoreLevel, MonitoredImageGenerationModuleHealthScore } from "./types.js";
export declare class ImageGenerationModuleHealthChecker {
    private readonly foundation;
    constructor(foundation: AiImageGenerationFoundation);
    checkAll(): MonitoredImageGenerationModuleHealthScore[];
    scoreToLevel(score: number): ImageGenerationHealthScoreLevel;
    private checkModule;
}
//# sourceMappingURL=module-health-checker.d.ts.map