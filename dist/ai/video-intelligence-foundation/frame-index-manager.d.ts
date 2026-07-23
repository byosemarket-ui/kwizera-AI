import { VideoFrameIndexEntry, VideoIndexType } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
export declare class FrameIndexManager {
    private readonly logger;
    private indexes;
    private indexesPath;
    private catalogPath;
    private lookupTimes;
    constructor(logger: VideoIntelligenceFoundationLogger);
    initialize(storage: VideoIntelligenceStorageManager): void;
    indexEntry(input: Omit<VideoFrameIndexEntry, "indexId" | "createdAt"> & {
        indexId?: string;
    }): VideoFrameIndexEntry;
    indexFrame(projectId: string, videoId: string, frameNumber: number, timecodeMs: number, opts?: {
        keyframe?: boolean;
        sceneId?: string;
        timelineId?: string;
    }): VideoFrameIndexEntry;
    indexScene(projectId: string, videoId: string, sceneId: string, startMs: number, endMs: number, timelineId?: string): VideoFrameIndexEntry;
    indexTimeline(projectId: string, videoId: string, timelineId: string): VideoFrameIndexEntry;
    indexShot(projectId: string, videoId: string, shotId: string, sceneId: string, timecodeMs: number): VideoFrameIndexEntry;
    indexSequence(projectId: string, videoId: string, sequenceId: string): VideoFrameIndexEntry;
    lookupById(indexId: string): VideoFrameIndexEntry | undefined;
    lookupByFrame(videoId: string, frameNumber: number): VideoFrameIndexEntry | undefined;
    lookupByTimecode(videoId: string, timecodeMs: number, toleranceMs?: number): VideoFrameIndexEntry | undefined;
    searchIndexes(query: {
        projectId?: string;
        videoId?: string;
        indexType?: VideoIndexType;
        sceneId?: string;
        timelineId?: string;
        limit?: number;
    }): VideoFrameIndexEntry[];
    getCount(): number;
    getCountByType(): Record<string, number>;
    getAverageLookupMs(): number;
    verifyIntegrity(): {
        valid: boolean;
        issues: string[];
    };
    private loadFromDisk;
    private persist;
}
//# sourceMappingURL=frame-index-manager.d.ts.map