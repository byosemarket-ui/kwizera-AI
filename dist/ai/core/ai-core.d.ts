import { AiCoreManager, AiCoreManagerOptions } from "./ai-core-manager.js";
import { APPLICATION_NAME, AI_ASSISTANT_NAME } from "./types.js";
/**
 * KWIZERA AI Core — central intelligent coordinator for KWIZERA AI STUDIO.
 * Step 2A foundation only. No business logic. No future module implementations.
 */
export declare class AiCore {
    private static instance;
    private readonly manager;
    static create(options?: AiCoreManagerOptions): AiCore;
    private constructor();
    static getInstance(options?: AiCoreManagerOptions): AiCore;
    static resetInstance(): void;
    getAssistantName(): typeof AI_ASSISTANT_NAME;
    getApplicationName(): typeof APPLICATION_NAME;
    getManager(): AiCoreManager;
    start(correlationId?: string): Promise<void>;
    stop(reason?: string): Promise<void>;
    getStatusReport(): import("./types.js").AiCoreStatusReport;
}
export declare function createAiCore(options?: AiCoreManagerOptions): AiCore;
//# sourceMappingURL=ai-core.d.ts.map