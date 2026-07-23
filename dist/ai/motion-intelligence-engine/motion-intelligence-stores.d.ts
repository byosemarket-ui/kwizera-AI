import { MotionIntelligenceRecord } from "./types.js";
export declare class MotionIntelligenceRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: MotionIntelligenceRecord): void;
    get(videoId: string): MotionIntelligenceRecord | undefined;
    getAll(): MotionIntelligenceRecord[];
    getCount(): number;
}
//# sourceMappingURL=motion-intelligence-stores.d.ts.map