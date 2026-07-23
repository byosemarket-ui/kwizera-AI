/**
 * KWIZERA AI STUDIO — Storyboard Intelligence Engine types (Step 5G)
 */
export class StoryboardIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "StoryboardIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map