import fs from "node:fs";
import path from "node:path";

export interface VideoGenerationHistoryRecord {
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

export class VideoGenerationHistoryStore {
  private historyPath: string | null = null;
  private readonly records: VideoGenerationHistoryRecord[] = [];

  initialize(generationDirectory: string): void {
    const historyDir = path.join(generationDirectory, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    this.historyPath = path.join(historyDir, "video-generation-history.jsonl");
  }

  append(record: VideoGenerationHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<VideoGenerationHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }
}
