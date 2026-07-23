import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationResourceMetrics } from "./resource-monitor.js";
import { ImageGenerationHealthWarning, MonitoredImageGenerationModuleHealthScore } from "./types.js";
export declare class ImageGenerationEarlyWarningSystem {
    private readonly foundation;
    constructor(foundation: AiImageGenerationFoundation);
    detect(moduleScores: MonitoredImageGenerationModuleHealthScore[], metrics: ImageGenerationResourceMetrics): Promise<ImageGenerationHealthWarning[]>;
    private warn;
}
//# sourceMappingURL=early-warning-system.d.ts.map