import { randomUUID } from "node:crypto";
import { AiCoreError } from "./types.js";
export class AiSessionManager {
    sessions = new Map();
    maxConcurrentSessions = 10;
    configure(maxConcurrentSessions) {
        this.maxConcurrentSessions = maxConcurrentSessions;
    }
    createSession(metadata = {}, logger) {
        const activeCount = this.getActiveSessionCount();
        if (activeCount >= this.maxConcurrentSessions) {
            throw new AiCoreError(`Maximum concurrent sessions reached (${this.maxConcurrentSessions})`, "SESSION_LIMIT_REACHED");
        }
        const now = new Date().toISOString();
        const session = {
            id: randomUUID(),
            createdAt: now,
            lastActiveAt: now,
            status: "active",
            metadata,
        };
        this.sessions.set(session.id, session);
        logger?.info("session", "Session created", { sessionId: session.id });
        return session;
    }
    getSession(id) {
        return this.sessions.get(id);
    }
    touchSession(id) {
        const session = this.sessions.get(id);
        if (session) {
            session.lastActiveAt = new Date().toISOString();
        }
    }
    pauseSession(id, logger) {
        const session = this.sessions.get(id);
        if (session) {
            session.status = "paused";
            session.lastActiveAt = new Date().toISOString();
            logger?.info("session", "Session paused", { sessionId: id });
        }
    }
    resumeSession(id, logger) {
        const session = this.sessions.get(id);
        if (session) {
            session.status = "active";
            session.lastActiveAt = new Date().toISOString();
            logger?.info("session", "Session resumed", { sessionId: id });
        }
    }
    closeSession(id, logger) {
        const session = this.sessions.get(id);
        if (session) {
            session.status = "closed";
            session.lastActiveAt = new Date().toISOString();
            logger?.info("session", "Session closed", { sessionId: id });
        }
    }
    closeAllSessions(logger) {
        for (const session of this.sessions.values()) {
            if (session.status !== "closed") {
                session.status = "closed";
                session.lastActiveAt = new Date().toISOString();
            }
        }
        logger?.info("session", "All sessions closed", { count: this.sessions.size });
    }
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter((s) => s.status === "active");
    }
    getActiveSessionCount() {
        return this.getActiveSessions().length;
    }
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
}
//# sourceMappingURL=ai-session-manager.js.map