import fs from "node:fs";
import path from "node:path";

export interface VideoIntelligenceHistoryRecord {
  timestamp: string;
  event: string;
  category?: string;
  operation?: string;
  requesterId?: string;
  projectId?: string;
  videoId?: string;
  durationMs?: number;
  success: boolean;
  detail?: string;
}

export class VideoIntelligenceHistoryStore {
  private historyPath: string | null = null;
  private readonly records: VideoIntelligenceHistoryRecord[] = [];

  initialize(intelligenceDirectory: string): void {
    const historyDir = path.join(intelligenceDirectory, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    this.historyPath = path.join(historyDir, "video-intelligence-history.jsonl");
  }

  append(record: VideoIntelligenceHistoryRecord): void {
    this.records.push(record);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getRecords(): ReadonlyArray<VideoIntelligenceHistoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }
}
