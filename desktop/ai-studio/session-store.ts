import type { AiStudioSession, StudioMessage } from "./types";

const STORE_KEY = "kwizera.ai-studio.sessions.v1";
const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function welcomeMessage(): StudioMessage {
  return {
    id: createId(),
    kind: "assistant",
    createdAt: new Date().toISOString(),
    title: "Studio assistant",
    body: "Your AI workspace is ready. I can organize context, surface recommendations, and keep the creative workflow visible. No generation task has been started.",
  };
}

export class AiStudioSessionManager {
  load(): AiStudioSession[] {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as AiStudioSession[];
      return saved.length ? saved : [this.create()];
    } catch {
      return [this.create()];
    }
  }

  save(allSessions: AiStudioSession[]): void {
    localStorage.setItem(STORE_KEY, JSON.stringify(allSessions));
  }

  create(): AiStudioSession {
    const now = new Date().toISOString();
    return { id: createId(), title: "Creative workspace session", createdAt: now, updatedAt: now, messages: [welcomeMessage()] };
  }

  append(session: AiStudioSession, message: Omit<StudioMessage, "id" | "createdAt">): AiStudioSession {
    return {
      ...session,
      updatedAt: new Date().toISOString(),
      messages: [...session.messages, { ...message, id: createId(), createdAt: new Date().toISOString() }],
    };
  }
}