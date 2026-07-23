import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import { RenderingUpstreamAssets } from "./rendering-preparation-analyzer.js";
import { RenderingPreparationInput, RenderingPreparationRecord, RenderingPreparationRelationships } from "./types.js";
export declare class RenderingPreparationLinker {
    detectRelationships(record: RenderingPreparationRecord, storyboard: StoryboardGenerationRecord, upstream: RenderingUpstreamAssets, input: RenderingPreparationInput): RenderingPreparationRelationships;
}
//# sourceMappingURL=rendering-preparation-linker.d.ts.map