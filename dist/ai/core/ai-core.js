import { AiCoreManager } from "./ai-core-manager.js";
import { APPLICATION_NAME, AI_ASSISTANT_NAME } from "./types.js";
/**
 * KWIZERA AI Core — central intelligent coordinator for KWIZERA AI STUDIO.
 * Step 2A foundation only. No business logic. No future module implementations.
 */
export class AiCore {
    static instance = null;
    manager;
    static create(options) {
        return new AiCore(options);
    }
    constructor(options = {}) {
        this.manager = new AiCoreManager(options);
    }
    static getInstance(options) {
        if (!AiCore.instance) {
            AiCore.instance = new AiCore(options);
        }
        return AiCore.instance;
    }
    static resetInstance() {
        AiCore.instance = null;
    }
    getAssistantName() {
        return AI_ASSISTANT_NAME;
    }
    getApplicationName() {
        return APPLICATION_NAME;
    }
    getManager() {
        return this.manager;
    }
    async start(correlationId) {
        await this.manager.start(correlationId);
    }
    async stop(reason) {
        await this.manager.stop(reason);
    }
    getStatusReport() {
        return this.manager.getStatusReport();
    }
}
export function createAiCore(options) {
    return AiCore.create(options);
}
//# sourceMappingURL=ai-core.js.map