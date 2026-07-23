import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MarketingMemoryLogger } from "./marketing-logger.js";
import { MarketingRelationships } from "./types.js";

export class MarketingRelationshipLinker {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: MarketingMemoryLogger
  ) {}

  link(
    campaignId: string,
    projectId: string,
    brand: string,
    product: string,
    tags: string[] = []
  ): MarketingRelationships {
    const indexEngine = this.foundation.getIndexEngine();
    const storage = this.foundation.getStorageEngine();

    const relationships: MarketingRelationships = {
      relatedCampaigns: [],
      relatedProducts: [],
      relatedBrands: [],
      relatedVideos: [],
      relatedStyles: [],
      relatedCustomerTypes: [],
      relatedMemories: [],
    };

    const byProject = indexEngine.lookup({ project: projectId });
    relationships.relatedMemories = byProject.memoryIds.filter((id) => id !== campaignId);

    if (brand) {
      const byBrand = indexEngine.lookup({ brand });
      for (const id of byBrand.memoryIds) {
        if (id !== campaignId) relationships.relatedBrands.push(id);
      }
    }

    for (const id of relationships.relatedMemories) {
      const entry = storage.findIndexEntry(id);
      if (!entry) continue;

      switch (entry.memoryType) {
        case MemoryStorageType.Marketing:
          if (id !== campaignId) relationships.relatedCampaigns.push(id);
          break;
        case MemoryStorageType.Product:
          if (product && entry.searchableText.includes(product.toLowerCase())) {
            relationships.relatedProducts.push(id);
          }
          break;
        case MemoryStorageType.Video:
          relationships.relatedVideos.push(id);
          break;
        default:
          break;
      }
    }

    for (const tag of tags) {
      const byTag = indexEngine.lookup({ tags: [tag] });
      for (const id of byTag.memoryIds) {
        if (id === campaignId) continue;
        if (tag.includes("style")) relationships.relatedStyles.push(id);
        if (tag.includes("customer")) relationships.relatedCustomerTypes.push(id);
      }
    }

    this.logger.log("info", "relationship", "Marketing relationships linked", {
      campaignId,
      related: relationships.relatedMemories.length,
    });

    return relationships;
  }
}
