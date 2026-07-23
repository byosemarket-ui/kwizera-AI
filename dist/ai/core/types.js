/**
 * KWIZERA AI STUDIO — AI Core shared types (Step 2A)
 */
export const AI_ASSISTANT_NAME = "KWIZERA AI";
export const APPLICATION_NAME = "KWIZERA AI STUDIO";
/** AI Core lifecycle states per Step 2A */
export var AiLifecycleState;
(function (AiLifecycleState) {
    AiLifecycleState["Initializing"] = "initializing";
    AiLifecycleState["Loading"] = "loading";
    AiLifecycleState["Ready"] = "ready";
    AiLifecycleState["Running"] = "running";
    AiLifecycleState["Paused"] = "paused";
    AiLifecycleState["Recovering"] = "recovering";
    AiLifecycleState["Stopping"] = "stopping";
    AiLifecycleState["Stopped"] = "stopped";
    AiLifecycleState["Failed"] = "failed";
})(AiLifecycleState || (AiLifecycleState = {}));
export class AiCoreError extends Error {
    code;
    diagnostic;
    constructor(message, code, diagnostic) {
        super(message);
        this.code = code;
        this.diagnostic = diagnostic;
        this.name = "AiCoreError";
    }
}
//# sourceMappingURL=types.js.map