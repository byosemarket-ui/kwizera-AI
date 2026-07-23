import { MemoryStorageType } from "../memory-storage-engine/types.js";
export class ProductRelationshipLinker {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    link(productId, projectId, brand, category, tags = []) {
        const indexEngine = this.foundation.getIndexEngine();
        const storage = this.foundation.getStorageEngine();
        const relationships = {
            similarProducts: [],
            relatedProducts: [],
            complementaryProducts: [],
            replacementProducts: [],
            sameBrand: [],
            sameCampaign: [],
            relatedVideos: [],
            relatedMarketing: [],
            relatedMemories: [],
        };
        if (projectId) {
            const byProject = indexEngine.lookup({ project: projectId });
            relationships.relatedMemories = byProject.memoryIds.filter((id) => id !== productId);
            relationships.sameCampaign = relationships.relatedMemories.filter((id) => {
                const entry = storage.findIndexEntry(id);
                return entry?.memoryType === MemoryStorageType.Marketing;
            });
        }
        if (brand) {
            const byBrand = indexEngine.lookup({ brand });
            for (const id of byBrand.memoryIds) {
                if (id === productId)
                    continue;
                const entry = storage.findIndexEntry(id);
                if (entry?.memoryType === MemoryStorageType.Product) {
                    relationships.sameBrand.push(id);
                    relationships.similarProducts.push(id);
                }
            }
        }
        if (category) {
            const byCategory = indexEngine.lookup({ category });
            for (const id of byCategory.memoryIds) {
                if (id === productId)
                    continue;
                const entry = storage.findIndexEntry(id);
                if (entry?.memoryType === MemoryStorageType.Product && !relationships.similarProducts.includes(id)) {
                    relationships.similarProducts.push(id);
                    relationships.relatedProducts.push(id);
                }
            }
        }
        for (const id of relationships.relatedMemories) {
            const entry = storage.findIndexEntry(id);
            if (!entry)
                continue;
            if (entry.memoryType === MemoryStorageType.Video)
                relationships.relatedVideos.push(id);
            if (entry.memoryType === MemoryStorageType.Marketing)
                relationships.relatedMarketing.push(id);
        }
        for (const tag of tags) {
            if (tag.includes("complement"))
                relationships.complementaryProducts.push(productId);
            if (tag.includes("replacement"))
                relationships.replacementProducts.push(productId);
        }
        this.logger.log("info", "relationship", "Product relationships linked", {
            productId,
            similar: relationships.similarProducts.length,
            related: relationships.relatedMemories.length,
        });
        return relationships;
    }
}
//# sourceMappingURL=product-relationship-linker.js.map