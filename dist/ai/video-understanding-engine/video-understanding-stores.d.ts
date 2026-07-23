import { VideoUnderstandingRecord } from "./types.js";
export declare class VideoUnderstandingRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VideoUnderstandingRecord): void;
    get(videoId: string): VideoUnderstandingRecord | undefined;
    getAll(): VideoUnderstandingRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=video-understanding-stores.d.ts.map