import { CompositionIntelligenceRecord } from "./types.js";
export declare class CompositionIntelligenceRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: CompositionIntelligenceRecord): void;
    get(imageId: string): CompositionIntelligenceRecord | undefined;
    getAll(): CompositionIntelligenceRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=composition-stores.d.ts.map