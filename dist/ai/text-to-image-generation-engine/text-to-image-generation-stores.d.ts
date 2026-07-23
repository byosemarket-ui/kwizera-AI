import { TextToImageGenerationRecord } from "./types.js";
export declare class TextToImageGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: TextToImageGenerationRecord): void;
    get(imagePlanId: string): TextToImageGenerationRecord | undefined;
    getByProduct(productId: string): TextToImageGenerationRecord[];
    getByProject(projectId: string): TextToImageGenerationRecord[];
    getByPrompt(promptId: string): TextToImageGenerationRecord[];
    getAll(): TextToImageGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=text-to-image-generation-stores.d.ts.map