import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceResourceMetrics } from "./resource-monitor.js";
import { ImageIntelligenceHealthWarning, MonitoredImageIntelligenceModuleHealthScore } from "./types.js";
export declare class ImageIntelligenceEarlyWarningSystem {
    private readonly foundation;
    constructor(foundation: AiImageIntelligenceFoundation);
    detect(moduleScores: MonitoredImageIntelligenceModuleHealthScore[], metrics: ImageIntelligenceResourceMetrics): Promise<ImageIntelligenceHealthWarning[]>;
    private warn;
}
//# sourceMappingURL=early-warning-system.d.ts.map