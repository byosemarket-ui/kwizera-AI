import { CreativeDirectionRecord } from "./types.js";
export declare class CreativeDirectionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: CreativeDirectionRecord): void;
    get(creativeId: string): CreativeDirectionRecord | undefined;
    getByProduct(productId: string): CreativeDirectionRecord[];
    getAll(): CreativeDirectionRecord[];
    getCount(): number;
}
//# sourceMappingURL=creative-direction-stores.d.ts.map