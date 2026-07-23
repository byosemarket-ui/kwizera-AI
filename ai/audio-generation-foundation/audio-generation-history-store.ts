import fs from "node:fs";
import path from "node:path";

export interface AudioGenerationHistoryRecord {
  timestamp: string;
  event: string;
  category?: string;
  operation?: string;
  requesterId?: string;
  projectId?: string;
  durationMs?: number;
  success: boolean;
  detail?: string;
}

export class AudioGenerationHistoryStore {
  private historyPath: string | null = null;
  private readonly records: AudioGenerationHistoryRecord[] = [];

  initialize(generationDirectory: string): void {
    const historyDir = path.join(generationDirectory, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    this.historyPath = path.join(historyDir, "audio-generation-history.jsonl");
  }

  append(record: AudioGenerationHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<AudioGenerationHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }
}
