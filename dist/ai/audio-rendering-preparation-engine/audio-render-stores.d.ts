import { AudioRenderRecord } from "./types.js";
export declare class AudioRenderRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AudioRenderRecord): void;
    get(audioRenderPlanId: string): AudioRenderRecord | undefined;
    getByProduction(productionId: string): AudioRenderRecord[];
    getByProduct(productId: string): AudioRenderRecord[];
    getAll(): AudioRenderRecord[];
    getCount(): number;
}
//# sourceMappingURL=audio-render-stores.d.ts.map