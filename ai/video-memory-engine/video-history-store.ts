import fs from "node:fs";
import path from "node:path";

export interface VideoHistoryEvent {
  timestamp: string;
  event: "create" | "update" | "complete" | "export" | "pattern" | "learn";
  videoId: string;
  projectId: string;
  detail: string;
  version?: number;
}

export class VideoHistoryStore {
  private historyPath: string | null = null;
  private readonly events: VideoHistoryEvent[] = [];

  initialize(videoDir: string): void {
    fs.mkdirSync(videoDir, { recursive: true });
    this.historyPath = path.join(videoDir, "video-history.jsonl");
    if (fs.existsSync(this.historyPath)) {
      const lines = fs.readFileSync(this.historyPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.events.push(JSON.parse(line) as VideoHistoryEvent);
      }
    }
  }

  append(event: VideoHistoryEvent): void {
    this.events.push(event);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(event)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<VideoHistoryEvent> {
    return this.events;
  }

  getByVideo(videoId: string): VideoHistoryEvent[] {
    return this.events.filter((e) => e.videoId === videoId);
  }

  getByProject(projectId: string): VideoHistoryEvent[] {
    return this.events.filter((e) => e.projectId === projectId);
  }

  getCount(): number {
    return this.events.length;
  }
}
