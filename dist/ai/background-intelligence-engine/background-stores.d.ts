import { BackgroundIntelligenceRecord } from "./types.js";
export declare class BackgroundIntelligenceRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: BackgroundIntelligenceRecord): void;
    get(imageId: string): BackgroundIntelligenceRecord | undefined;
    getAll(): BackgroundIntelligenceRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=background-stores.d.ts.map