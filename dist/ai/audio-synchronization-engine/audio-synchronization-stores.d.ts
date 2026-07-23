import { AudioSynchronizationRecord } from "./types.js";
export declare class AudioSynchronizationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AudioSynchronizationRecord): void;
    get(audioSynchronizationId: string): AudioSynchronizationRecord | undefined;
    getByScene(sceneId: string): AudioSynchronizationRecord[];
    getByStoryboard(storyboardId: string): AudioSynchronizationRecord[];
    getAll(): AudioSynchronizationRecord[];
    getCount(): number;
}
//# sourceMappingURL=audio-synchronization-stores.d.ts.map