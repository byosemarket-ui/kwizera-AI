import fs from "node:fs";
import path from "node:path";

export interface ProjectHistoryEvent {
  timestamp: string;
  event: "create" | "update" | "version" | "checkpoint" | "restore" | "archive" | "export";
  projectId: string;
  detail: string;
  version?: number;
  status?: string;
}

export class ProjectHistoryStore {
  private historyPath: string | null = null;
  private readonly events: ProjectHistoryEvent[] = [];

  initialize(projectDir: string): void {
    fs.mkdirSync(projectDir, { recursive: true });
    this.historyPath = path.join(projectDir, "project-history.jsonl");
    if (fs.existsSync(this.historyPath)) {
      const lines = fs.readFileSync(this.historyPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.events.push(JSON.parse(line) as ProjectHistoryEvent);
      }
    }
  }

  append(event: ProjectHistoryEvent): void {
    this.events.push(event);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(event)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<ProjectHistoryEvent> {
    return this.events;
  }

  getByProject(projectId: string): ProjectHistoryEvent[] {
    return this.events.filter((e) => e.projectId === projectId);
  }

  getCount(): number {
    return this.events.length;
  }
}
