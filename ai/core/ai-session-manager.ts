import { randomUUID } from "node:crypto";
import { AiCoreError, AiSession } from "./types.js";
import type { AiCoreLogger } from "./logger.js";

export class AiSessionManager {
  private readonly sessions = new Map<string, AiSession>();
  private maxConcurrentSessions = 10;

  configure(maxConcurrentSessions: number): void {
    this.maxConcurrentSessions = maxConcurrentSessions;
  }

  createSession(metadata: Record<string, unknown> = {}, logger?: AiCoreLogger): AiSession {
    const activeCount = this.getActiveSessionCount();
    if (activeCount >= this.maxConcurrentSessions) {
      throw new AiCoreError(
        `Maximum concurrent sessions reached (${this.maxConcurrentSessions})`,
        "SESSION_LIMIT_REACHED"
      );
    }

    const now = new Date().toISOString();
    const session: AiSession = {
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

  getSession(id: string): AiSession | undefined {
    return this.sessions.get(id);
  }

  touchSession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActiveAt = new Date().toISOString();
    }
  }

  pauseSession(id: string, logger?: AiCoreLogger): void {
    const session = this.sessions.get(id);
    if (session) {
      session.status = "paused";
      session.lastActiveAt = new Date().toISOString();
      logger?.info("session", "Session paused", { sessionId: id });
    }
  }

  resumeSession(id: string, logger?: AiCoreLogger): void {
    const session = this.sessions.get(id);
    if (session) {
      session.status = "active";
      session.lastActiveAt = new Date().toISOString();
      logger?.info("session", "Session resumed", { sessionId: id });
    }
  }

  closeSession(id: string, logger?: AiCoreLogger): void {
    const session = this.sessions.get(id);
    if (session) {
      session.status = "closed";
      session.lastActiveAt = new Date().toISOString();
      logger?.info("session", "Session closed", { sessionId: id });
    }
  }

  closeAllSessions(logger?: AiCoreLogger): void {
    for (const session of this.sessions.values()) {
      if (session.status !== "closed") {
        session.status = "closed";
        session.lastActiveAt = new Date().toISOString();
      }
    }
    logger?.info("session", "All sessions closed", { count: this.sessions.size });
  }

  getActiveSessions(): AiSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === "active");
  }

  getActiveSessionCount(): number {
    return this.getActiveSessions().length;
  }

  getAllSessions(): AiSession[] {
    return Array.from(this.sessions.values());
  }
}
