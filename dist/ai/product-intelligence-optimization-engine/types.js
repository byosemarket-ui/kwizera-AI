/**
 * KWIZERA AI STUDIO — Product Intelligence Optimization Engine types (Step 5M)
 */
export class ProductIntelligenceOptimizationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductIntelligenceOptimizationEngineError";
    }
}
//# sourceMappingURL=types.js.map