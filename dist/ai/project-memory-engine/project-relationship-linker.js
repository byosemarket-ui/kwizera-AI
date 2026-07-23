import { MemoryStorageType } from "../memory-storage-engine/types.js";
export class ProjectRelationshipLinker {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    link(projectId, tags = []) {
        const indexEngine = this.foundation.getIndexEngine();
        const relationships = {
            similarProjects: [],
            relatedProducts: [],
            relatedVideos: [],
            relatedMarketing: [],
            relatedLearning: [],
            relatedMemories: [],
            relatedKnowledge: [],
        };
        const byProject = indexEngine.lookup({ project: projectId });
        relationships.relatedMemories = byProject.memoryIds.filter((id) => id !== projectId);
        const relatedIds = indexEngine.getRelated(projectId);
        const storage = this.foundation.getStorageEngine();
        for (const id of relatedIds) {
            const entry = storage.findIndexEntry(id);
            if (!entry)
                continue;
            switch (entry.memoryType) {
                case MemoryStorageType.Product:
                    relationships.relatedProducts.push(id);
                    break;
                case MemoryStorageType.Video:
                    relationships.relatedVideos.push(id);
                    break;
                case MemoryStorageType.Marketing:
                    relationships.relatedMarketing.push(id);
                    break;
                case MemoryStorageType.Learning:
                    relationships.relatedLearning.push(id);
                    break;
                case MemoryStorageType.Knowledge:
                    relationships.relatedKnowledge.push(id);
                    break;
                case MemoryStorageType.Project:
                    if (id !== projectId) {
                        relationships.similarProjects.push(id);
                    }
                    break;
                default:
                    break;
            }
        }
        for (const tag of tags) {
            const byTag = indexEngine.lookup({ tags: [tag] });
            for (const id of byTag.memoryIds) {
                if (id !== projectId &&
                    !relationships.similarProjects.includes(id) &&
                    !relationships.relatedMemories.includes(id)) {
                    relationships.similarProjects.push(id);
                }
            }
        }
        this.logger.log("info", "relationship", "Project relationships linked", {
            projectId,
            total: relationships.relatedMemories.length,
        });
        return relationships;
    }
}
//# sourceMappingURL=project-relationship-linker.js.map