/**
 * KWIZERA AI STUDIO — Production Planning Engine types (Step 5K)
 */
export class ProductionPlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductionPlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map