/**
 * KWIZERA AI STUDIO — Image Intelligence Optimization Engine types (Step 6M)
 */
export class ImageIntelligenceOptimizationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageIntelligenceOptimizationEngineError";
    }
}
//# sourceMappingURL=types.js.map