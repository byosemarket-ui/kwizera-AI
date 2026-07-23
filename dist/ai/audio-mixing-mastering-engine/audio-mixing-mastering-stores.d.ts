import { AudioMixMasterGenerationRecord } from "./types.js";
export declare class AudioMixingMasteringRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AudioMixMasterGenerationRecord): void;
    get(mixingPlanId: string): AudioMixMasterGenerationRecord | undefined;
    getByProduct(productId: string): AudioMixMasterGenerationRecord[];
    getBySession(sessionId: string): AudioMixMasterGenerationRecord[];
    getAll(): AudioMixMasterGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=audio-mixing-mastering-stores.d.ts.map