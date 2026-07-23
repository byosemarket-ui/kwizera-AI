import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { VideoMemoryLogger } from "./video-logger.js";
import { VideoRelationships } from "./types.js";
export declare class VideoRelationshipLinker {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: VideoMemoryLogger);
    link(videoId: string, projectId: string, brand: string, category: string, tags?: string[]): VideoRelationships;
}
//# sourceMappingURL=video-relationship-linker.d.ts.map