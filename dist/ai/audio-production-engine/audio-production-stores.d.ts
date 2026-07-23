import { AudioProductionRecord } from "./types.js";
export declare class AudioProductionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AudioProductionRecord): void;
    get(audioProductionId: string): AudioProductionRecord | undefined;
    getByAudioPlan(audioPlanId: string): AudioProductionRecord[];
    getByProduct(productId: string): AudioProductionRecord[];
    getAll(): AudioProductionRecord[];
    getCount(): number;
}
//# sourceMappingURL=audio-production-stores.d.ts.map