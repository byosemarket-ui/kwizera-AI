import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { VideoHistoryStore } from "./video-history-store.js";
import { VideoLearner } from "./video-learner.js";
import { VideoMemoryLogger } from "./video-logger.js";
import { VideoPatternDetector } from "./video-pattern-detector.js";
import { VideoRelationshipLinker } from "./video-relationship-linker.js";
import { VideoScorer } from "./video-scorer.js";
import { VideoCreateInput, VideoLearningResult, VideoProcessResult, VideoRecord, VideoUpdateInput } from "./types.js";
export declare function recordFromMemory(record: MemoryRecord): VideoRecord;
export declare class VideoProcessor {
    private readonly foundation;
    private readonly history;
    private readonly scorer;
    private readonly patternDetector;
    private readonly linker;
    private readonly learner;
    private readonly logger;
    private readonly videos;
    constructor(foundation: AiMemoryFoundation, history: VideoHistoryStore, scorer: VideoScorer, patternDetector: VideoPatternDetector, linker: VideoRelationshipLinker, learner: VideoLearner, logger: VideoMemoryLogger, videos: Map<string, VideoRecord>);
    create(input: VideoCreateInput): Promise<VideoProcessResult>;
    update(videoId: string, input: VideoUpdateInput): Promise<VideoProcessResult>;
    complete(videoId: string, userSatisfaction?: number): Promise<VideoLearningResult>;
    loadVideo(videoId: string): Promise<VideoRecord | null>;
    private toMemoryInput;
    private toPayload;
    private summarizeChanges;
    private fail;
}
//# sourceMappingURL=video-processor.d.ts.map