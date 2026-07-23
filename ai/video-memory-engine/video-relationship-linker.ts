import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { VideoMemoryLogger } from "./video-logger.js";
import { VideoRelationships } from "./types.js";

export class VideoRelationshipLinker {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: VideoMemoryLogger
  ) {}

  link(
    videoId: string,
    projectId: string,
    brand: string,
    category: string,
    tags: string[] = []
  ): VideoRelationships {
    const indexEngine = this.foundation.getIndexEngine();
    const storage = this.foundation.getStorageEngine();

    const relationships: VideoRelationships = {
      similarVideos: [],
      similarProducts: [],
      similarMarketing: [],
      similarBrands: [],
      similarStyles: [],
      similarAudiences: [],
      relatedMemories: [],
    };

    const byProject = indexEngine.lookup({ project: projectId });
    relationships.relatedMemories = byProject.memoryIds.filter((id) => id !== videoId);

    if (brand) {
      const byBrand = indexEngine.lookup({ brand });
      for (const id of byBrand.memoryIds) {
        if (id !== videoId) relationships.similarBrands.push(id);
      }
    }

    if (category) {
      const byCategory = indexEngine.lookup({ category });
      for (const id of byCategory.memoryIds) {
        if (id !== videoId && !relationships.similarVideos.includes(id)) {
          relationships.similarVideos.push(id);
        }
      }
    }

    for (const tag of tags) {
      const byTag = indexEngine.lookup({ tags: [tag] });
      for (const id of byTag.memoryIds) {
        if (id === videoId) continue;
        const entry = storage.findIndexEntry(id);
        if (!entry) continue;

        if (entry.memoryType === MemoryStorageType.Video) {
          if (!relationships.similarVideos.includes(id)) relationships.similarVideos.push(id);
          if (tag.includes("style")) relationships.similarStyles.push(id);
        }
        if (entry.memoryType === MemoryStorageType.Product) {
          relationships.similarProducts.push(id);
        }
        if (entry.memoryType === MemoryStorageType.Marketing) {
          relationships.similarMarketing.push(id);
        }
      }
    }

    const relatedIds = indexEngine.getRelated(videoId);
    for (const id of relatedIds) {
      const entry = storage.findIndexEntry(id);
      if (!entry || id === videoId) continue;

      switch (entry.memoryType) {
        case MemoryStorageType.Video:
          if (!relationships.similarVideos.includes(id)) relationships.similarVideos.push(id);
          break;
        case MemoryStorageType.Product:
          relationships.similarProducts.push(id);
          break;
        case MemoryStorageType.Marketing:
          relationships.similarMarketing.push(id);
          break;
        default:
          break;
      }
    }

    this.logger.log("info", "relationship", "Video relationships linked", {
      videoId,
      similar: relationships.similarVideos.length,
      related: relationships.relatedMemories.length,
    });

    return relationships;
  }
}
