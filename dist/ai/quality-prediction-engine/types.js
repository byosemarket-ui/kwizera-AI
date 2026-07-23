/**
 * KWIZERA AI STUDIO — Quality Prediction Engine types (Step 5L)
 */
export class QualityPredictionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "QualityPredictionEngineError";
    }
}
//# sourceMappingURL=types.js.map