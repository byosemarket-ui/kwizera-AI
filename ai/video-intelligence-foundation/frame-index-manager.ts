import fs from "node:fs";
import path from "node:path";
import { VideoFrameIndexEntry, VideoIndexType } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";

interface IndexCatalog {
  lastUpdated: string;
  totalEntries: number;
  indexes: VideoFrameIndexEntry[];
  byType: Record<string, number>;
}

export class FrameIndexManager {
  private indexes = new Map<string, VideoFrameIndexEntry>();
  private indexesPath = "";
  private catalogPath = "";
  private lookupTimes: number[] = [];

  constructor(private readonly logger: VideoIntelligenceFoundationLogger) {}

  initialize(storage: VideoIntelligenceStorageManager): void {
    this.indexesPath = storage.getIndexesPath();
    this.catalogPath = path.join(this.indexesPath, "frame-index-catalog.json");
    fs.mkdirSync(this.indexesPath, { recursive: true });

    for (const type of Object.values(VideoIndexType)) {
      fs.mkdirSync(path.join(this.indexesPath, type), { recursive: true });
    }

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "indexing", "Frame index manager initialized", {
      indexCount: this.indexes.size,
    });
  }

  indexEntry(
    input: Omit<VideoFrameIndexEntry, "indexId" | "createdAt"> & { indexId?: string }
  ): VideoFrameIndexEntry {
    const indexId =
      input.indexId ??
      `idx-${input.indexType}-${input.videoId}-${input.frameNumber ?? input.timecodeMs ?? Date.now()}`;
    const entry: VideoFrameIndexEntry = {
      ...input,
      indexId,
      createdAt: new Date().toISOString(),
    };
    this.indexes.set(indexId, entry);
    this.persist();
    return entry;
  }

  indexFrame(
    projectId: string,
    videoId: string,
    frameNumber: number,
    timecodeMs: number,
    opts?: { keyframe?: boolean; sceneId?: string; timelineId?: string }
  ): VideoFrameIndexEntry {
    return this.indexEntry({
      indexType: opts?.keyframe ? VideoIndexType.Keyframe : VideoIndexType.Frame,
      projectId,
      videoId,
      frameNumber,
      timecodeMs,
      keyframe: opts?.keyframe,
      sceneId: opts?.sceneId,
      timelineId: opts?.timelineId,
      relationshipLinks: [videoId, projectId],
    });
  }

  indexScene(
    projectId: string,
    videoId: string,
    sceneId: string,
    startMs: number,
    endMs: number,
    timelineId?: string
  ): VideoFrameIndexEntry {
    return this.indexEntry({
      indexType: VideoIndexType.Scene,
      projectId,
      videoId,
      sceneId,
      timecodeMs: startMs,
      timelineId,
      label: `scene-${sceneId}`,
      relationshipLinks: [sceneId, videoId, projectId],
    });
  }

  indexTimeline(projectId: string, videoId: string, timelineId: string): VideoFrameIndexEntry {
    return this.indexEntry({
      indexType: VideoIndexType.Timeline,
      projectId,
      videoId,
      timelineId,
      label: `timeline-${timelineId}`,
      relationshipLinks: [timelineId, videoId, projectId],
    });
  }

  indexShot(
    projectId: string,
    videoId: string,
    shotId: string,
    sceneId: string,
    timecodeMs: number
  ): VideoFrameIndexEntry {
    return this.indexEntry({
      indexType: VideoIndexType.Shot,
      projectId,
      videoId,
      shotId,
      sceneId,
      timecodeMs,
      label: `shot-${shotId}`,
      relationshipLinks: [shotId, sceneId, videoId],
    });
  }

  indexSequence(projectId: string, videoId: string, sequenceId: string): VideoFrameIndexEntry {
    return this.indexEntry({
      indexType: VideoIndexType.Sequence,
      projectId,
      videoId,
      sequenceId,
      label: `sequence-${sequenceId}`,
      relationshipLinks: [sequenceId, videoId, projectId],
    });
  }

  lookupById(indexId: string): VideoFrameIndexEntry | undefined {
    const start = Date.now();
    const entry = this.indexes.get(indexId);
    this.lookupTimes.push(Date.now() - start);
    return entry;
  }

  lookupByFrame(videoId: string, frameNumber: number): VideoFrameIndexEntry | undefined {
    const start = Date.now();
    const entry = [...this.indexes.values()].find(
      (e) =>
        e.videoId === videoId &&
        e.frameNumber === frameNumber &&
        (e.indexType === VideoIndexType.Frame || e.indexType === VideoIndexType.Keyframe)
    );
    this.lookupTimes.push(Date.now() - start);
    return entry;
  }

  lookupByTimecode(videoId: string, timecodeMs: number, toleranceMs = 50): VideoFrameIndexEntry | undefined {
    const start = Date.now();
    const entry = [...this.indexes.values()].find(
      (e) =>
        e.videoId === videoId &&
        e.timecodeMs !== undefined &&
        Math.abs(e.timecodeMs - timecodeMs) <= toleranceMs
    );
    this.lookupTimes.push(Date.now() - start);
    return entry;
  }

  searchIndexes(query: {
    projectId?: string;
    videoId?: string;
    indexType?: VideoIndexType;
    sceneId?: string;
    timelineId?: string;
    limit?: number;
  }): VideoFrameIndexEntry[] {
    const start = Date.now();
    let results = [...this.indexes.values()];
    if (query.projectId) results = results.filter((e) => e.projectId === query.projectId);
    if (query.videoId) results = results.filter((e) => e.videoId === query.videoId);
    if (query.indexType) results = results.filter((e) => e.indexType === query.indexType);
    if (query.sceneId) results = results.filter((e) => e.sceneId === query.sceneId);
    if (query.timelineId) results = results.filter((e) => e.timelineId === query.timelineId);
    this.lookupTimes.push(Date.now() - start);
    return results.slice(0, query.limit ?? 100);
  }

  getCount(): number {
    return this.indexes.size;
  }

  getCountByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.indexes.values()) {
      counts[entry.indexType] = (counts[entry.indexType] ?? 0) + 1;
    }
    return counts;
  }

  getAverageLookupMs(): number {
    if (this.lookupTimes.length === 0) return 0;
    return Math.round(this.lookupTimes.reduce((a, b) => a + b, 0) / this.lookupTimes.length);
  }

  verifyIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!fs.existsSync(this.indexesPath)) {
      issues.push("Frame index directory missing");
    }
    for (const type of Object.values(VideoIndexType)) {
      if (!fs.existsSync(path.join(this.indexesPath, type))) {
        issues.push(`Index type directory missing: ${type}`);
      }
    }
    return { valid: issues.length === 0, issues };
  }

  private loadFromDisk(): void {
    const raw = fs.readFileSync(this.catalogPath, "utf8");
    const catalog = JSON.parse(raw) as IndexCatalog;
    this.indexes.clear();
    for (const entry of catalog.indexes) {
      this.indexes.set(entry.indexId, entry);
    }
  }

  private persist(): void {
    const byType: Record<string, number> = {};
    for (const entry of this.indexes.values()) {
      byType[entry.indexType] = (byType[entry.indexType] ?? 0) + 1;
    }
    const catalog: IndexCatalog = {
      lastUpdated: new Date().toISOString(),
      totalEntries: this.indexes.size,
      indexes: [...this.indexes.values()],
      byType,
    };
    fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2), "utf8");
  }
}
