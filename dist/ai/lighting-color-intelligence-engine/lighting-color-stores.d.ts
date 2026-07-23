import { LightingColorIntelligenceRecord } from "./types.js";
export declare class LightingColorIntelligenceRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: LightingColorIntelligenceRecord): void;
    get(imageId: string): LightingColorIntelligenceRecord | undefined;
    getAll(): LightingColorIntelligenceRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=lighting-color-stores.d.ts.map