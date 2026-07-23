import fs from "node:fs";
import path from "node:path";

export interface KnowledgeHistoryRecord {
  timestamp: string;
  event: string;
  category?: string;
  operation?: string;
  requesterId?: string;
  durationMs?: number;
  success: boolean;
  detail?: string;
}

export class KnowledgeHistoryStore {
  private historyPath: string | null = null;
  private readonly records: KnowledgeHistoryRecord[] = [];

  initialize(knowledgeDirectory: string): void {
    const historyDir = path.join(knowledgeDirectory, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    this.historyPath = path.join(historyDir, "knowledge-history.jsonl");
  }

  append(record: KnowledgeHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<KnowledgeHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getHistoryPath(): string | null {
    return this.historyPath;
  }
}
