import fs from "node:fs";
import path from "node:path";
import { LearningRecord } from "./types.js";

export class LearningHistoryStore {
  private historyPath: string | null = null;
  private readonly records: LearningRecord[] = [];

  initialize(learningDir: string): void {
    fs.mkdirSync(learningDir, { recursive: true });
    this.historyPath = path.join(learningDir, "learning-history.jsonl");
    if (fs.existsSync(this.historyPath)) {
      const lines = fs.readFileSync(this.historyPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.records.push(JSON.parse(line) as LearningRecord);
      }
    }
  }

  append(record: LearningRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<LearningRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  findById(learningId: string): LearningRecord | undefined {
    return this.records.find((r) => r.learningId === learningId);
  }

  getByProject(projectId: string): LearningRecord[] {
    return this.records.filter((r) => r.relatedProject === projectId);
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}
