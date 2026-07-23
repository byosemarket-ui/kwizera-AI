import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ImageIntelligenceAutoRepairResult, ImageIntelligenceHealthWarning } from "./types.js";
export declare class ImageIntelligenceAutoRepairHandler {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, logger: ImageIntelligenceHealthMonitorLogger);
    attemptRepairs(warnings: ImageIntelligenceHealthWarning[]): Promise<ImageIntelligenceAutoRepairResult>;
}
//# sourceMappingURL=auto-repair-handler.d.ts.map