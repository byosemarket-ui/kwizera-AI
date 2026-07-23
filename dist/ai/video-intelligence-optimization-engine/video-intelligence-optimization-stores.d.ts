import { VideoCacheOptimization, VideoIntelligenceOptimizationRecord, VideoIntelligenceRecoveryPoint } from "./types.js";
export declare class VideoIntelligenceOptimizationRecordStore {
    private storePath;
    private recoveryPath;
    private cachePath;
    private records;
    private recoveryPoints;
    private activeCache;
    initialize(engineDir: string): void;
    upsert(record: VideoIntelligenceOptimizationRecord): void;
    saveRecoveryPoint(point: VideoIntelligenceRecoveryPoint): void;
    getRecoveryPoint(recoveryId: string): VideoIntelligenceRecoveryPoint | undefined;
    updateCache(cache: VideoCacheOptimization): void;
    getCache(): VideoCacheOptimization;
    restoreCache(snapshot: VideoCacheOptimization): void;
    get(optimizationId: string): VideoIntelligenceOptimizationRecord | undefined;
    getByVideo(videoId: string): VideoIntelligenceOptimizationRecord[];
    getAll(): VideoIntelligenceOptimizationRecord[];
    getCount(): number;
}
//# sourceMappingURL=video-intelligence-optimization-stores.d.ts.map