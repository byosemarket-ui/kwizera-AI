/**
 * KWIZERA AI STUDIO — Visual Planning Engine types (Step 5I)
 */
export class VisualPlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VisualPlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map