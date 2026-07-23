import { AudienceIntelligenceRecord } from "./types.js";
export declare class AudienceRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AudienceIntelligenceRecord): void;
    get(audienceId: string): AudienceIntelligenceRecord | undefined;
    getByProduct(productId: string): AudienceIntelligenceRecord[];
    getAll(): AudienceIntelligenceRecord[];
    getCount(): number;
}
//# sourceMappingURL=audience-stores.d.ts.map