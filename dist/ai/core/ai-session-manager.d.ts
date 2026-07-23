import { AiSession } from "./types.js";
import type { AiCoreLogger } from "./logger.js";
export declare class AiSessionManager {
    private readonly sessions;
    private maxConcurrentSessions;
    configure(maxConcurrentSessions: number): void;
    createSession(metadata?: Record<string, unknown>, logger?: AiCoreLogger): AiSession;
    getSession(id: string): AiSession | undefined;
    touchSession(id: string): void;
    pauseSession(id: string, logger?: AiCoreLogger): void;
    resumeSession(id: string, logger?: AiCoreLogger): void;
    closeSession(id: string, logger?: AiCoreLogger): void;
    closeAllSessions(logger?: AiCoreLogger): void;
    getActiveSessions(): AiSession[];
    getActiveSessionCount(): number;
    getAllSessions(): AiSession[];
}
//# sourceMappingURL=ai-session-manager.d.ts.map