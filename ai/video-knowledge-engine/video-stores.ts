import fs from "node:fs";
import path from "node:path";
import { VideoAnalysisRecord, VideoLearningPattern } from "./types.js";

export class VideoPatternStore {
  private storePath = "";
  private patterns: VideoLearningPattern[] = [];

  initialize(videoDir: string): void {
    fs.mkdirSync(videoDir, { recursive: true });
    this.storePath = path.join(videoDir, "learned-patterns.json");
    if (fs.existsSync(this.storePath)) {
      this.patterns = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VideoLearningPattern[];
    }
  }

  add(pattern: VideoLearningPattern): void {
    if (this.patterns.some((p) => p.patternId === pattern.patternId)) return;
    this.patterns.push(pattern);
    fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
  }

  getAll(): VideoLearningPattern[] {
    return [...this.patterns];
  }

  getCount(): number {
    return this.patterns.length;
  }
}

export class VideoRecordStore {
  private storePath = "";
  private records = new Map<string, VideoAnalysisRecord>();

  initialize(videoDir: string): void {
    fs.mkdirSync(videoDir, { recursive: true });
    this.storePath = path.join(videoDir, "video-analysis-records.json");
    if (fs.existsSync(this.storePath)) {
      const data = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VideoAnalysisRecord[];
      for (const record of data) {
        this.records.set(record.videoId, record);
      }
    }
  }

  upsert(record: VideoAnalysisRecord): void {
    this.records.set(record.videoId, record);
    fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
  }

  get(videoId: string): VideoAnalysisRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): VideoAnalysisRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
