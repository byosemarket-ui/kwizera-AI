import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ProjectMemoryLogger } from "./project-logger.js";
export interface ProjectRelationships {
    similarProjects: string[];
    relatedProducts: string[];
    relatedVideos: string[];
    relatedMarketing: string[];
    relatedLearning: string[];
    relatedMemories: string[];
    relatedKnowledge: string[];
}
export declare class ProjectRelationshipLinker {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: ProjectMemoryLogger);
    link(projectId: string, tags?: string[]): ProjectRelationships;
}
//# sourceMappingURL=project-relationship-linker.d.ts.map