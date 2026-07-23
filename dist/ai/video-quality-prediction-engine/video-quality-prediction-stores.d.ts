import { VideoQualityPredictionRecord } from "./types.js";
export declare class VideoQualityPredictionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VideoQualityPredictionRecord): void;
    get(videoId: string): VideoQualityPredictionRecord | undefined;
    getAll(): VideoQualityPredictionRecord[];
    getCount(): number;
}
//# sourceMappingURL=video-quality-prediction-stores.d.ts.map