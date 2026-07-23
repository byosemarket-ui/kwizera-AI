/**
 * KWIZERA AI STUDIO — Audio Planning Engine types (Step 5J)
 */
export class AudioPlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudioPlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map