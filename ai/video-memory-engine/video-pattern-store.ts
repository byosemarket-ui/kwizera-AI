import fs from "node:fs";
import path from "node:path";
import { VideoPattern } from "./types.js";

export class VideoPatternStore {
  private patternsPath: string | null = null;
  private readonly patterns: VideoPattern[] = [];

  initialize(videoDir: string): void {
    fs.mkdirSync(videoDir, { recursive: true });
    this.patternsPath = path.join(videoDir, "video-patterns.jsonl");
    if (fs.existsSync(this.patternsPath)) {
      const lines = fs.readFileSync(this.patternsPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.patterns.push(JSON.parse(line) as VideoPattern);
      }
    }
  }

  store(pattern: VideoPattern): void {
    this.patterns.push(pattern);
    if (this.patternsPath) {
      fs.appendFileSync(this.patternsPath, `${JSON.stringify(pattern)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<VideoPattern> {
    return this.patterns;
  }

  getByType(type: VideoPattern["patternType"]): VideoPattern[] {
    return this.patterns.filter((p) => p.patternType === type);
  }

  getByVideo(videoId: string): VideoPattern[] {
    return this.patterns.filter((p) => p.sourceVideoId === videoId);
  }

  getReusable(): VideoPattern[] {
    return this.patterns.filter((p) => p.reusable && p.confidence >= 60);
  }

  getCount(): number {
    return this.patterns.length;
  }
}
