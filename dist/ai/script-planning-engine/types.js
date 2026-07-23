/**
 * KWIZERA AI STUDIO — Script Planning Engine types (Step 5H)
 */
export class ScriptPlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ScriptPlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map