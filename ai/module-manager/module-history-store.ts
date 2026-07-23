import fs from "node:fs";
import path from "node:path";
import { ModuleHistoryEvent, ModulePerformanceStats } from "./types.js";

export class ModuleHistoryStore {
  private historyPath: string | null = null;
  private readonly events: ModuleHistoryEvent[] = [];
  private readonly performance: ModulePerformanceStats[] = [];

  initialize(modulesDirectory: string): void {
    fs.mkdirSync(modulesDirectory, { recursive: true });
    this.historyPath = path.join(modulesDirectory, "module-history.jsonl");
  }

  appendEvent(event: ModuleHistoryEvent): void {
    this.events.push(event);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify({ type: "event", ...event })}\n`, "utf8");
    }
  }

  appendPerformance(stats: ModulePerformanceStats): void {
    this.performance.push(stats);
    if (this.historyPath) {
      fs.appendFileSync(
        this.historyPath,
        `${JSON.stringify({ type: "performance", ...stats })}\n`,
        "utf8"
      );
    }
  }

  getEvents(): ReadonlyArray<ModuleHistoryEvent> {
    return this.events;
  }

  getPerformance(): ReadonlyArray<ModulePerformanceStats> {
    return this.performance;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}
