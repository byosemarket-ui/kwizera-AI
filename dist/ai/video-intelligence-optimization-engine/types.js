/**

 * KWIZERA AI STUDIO — Video Intelligence Optimization Engine types (Step 7M)

 */
export class VideoIntelligenceOptimizationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoIntelligenceOptimizationEngineError";
    }
}
//# sourceMappingURL=types.js.map