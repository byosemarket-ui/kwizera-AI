import { CreativeVideoIntelligenceRecord } from "./types.js";
export declare class CreativeVideoRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: CreativeVideoIntelligenceRecord): void;
    get(videoId: string): CreativeVideoIntelligenceRecord | undefined;
    getAll(): CreativeVideoIntelligenceRecord[];
    getCount(): number;
}
//# sourceMappingURL=creative-video-stores.d.ts.map