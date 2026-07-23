import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationHealthMonitorLogger } from "./health-logger.js";
import { ImageGenerationAutoRepairResult, ImageGenerationHealthWarning } from "./types.js";
export declare class ImageGenerationAutoRepairHandler {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, logger: ImageGenerationHealthMonitorLogger);
    attemptRepairs(warnings: ImageGenerationHealthWarning[]): Promise<ImageGenerationAutoRepairResult>;
}
//# sourceMappingURL=auto-repair-handler.d.ts.map