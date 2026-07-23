import { TimelineIntelligenceRecord } from "./types.js";
export declare class TimelineIntelligenceRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: TimelineIntelligenceRecord): void;
    get(videoId: string): TimelineIntelligenceRecord | undefined;
    getAll(): TimelineIntelligenceRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=timeline-intelligence-stores.d.ts.map