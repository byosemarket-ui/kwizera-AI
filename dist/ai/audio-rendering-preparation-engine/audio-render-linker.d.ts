import type { AudioProductionRecord } from "../audio-production-engine/types.js";
import { AudioRenderInput, AudioRenderRecord, AudioRenderRelationships } from "./types.js";
export declare class AudioRenderLinker {
    detectRelationships(record: AudioRenderRecord, input: AudioRenderInput, productionPlan?: AudioProductionRecord | null, productId?: string): AudioRenderRelationships;
}
//# sourceMappingURL=audio-render-linker.d.ts.map