import { IndexType } from "./types.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { MemoryIndexLogger } from "./index-logger.js";

export class IndexOptimizer {
  constructor(
    private readonly invertedStore: InvertedIndexStore,
    private readonly logger: MemoryIndexLogger
  ) {}

  optimize(): { optimizedTypes: number; removedEmpty: number; durationMs: number } {
    const start = Date.now();
    let optimizedTypes = 0;
    let removedEmpty = 0;

    for (const type of Object.values(IndexType)) {
      if (type === IndexType.Related) continue;
      const index = this.invertedStore.getIndex(type);
      let changed = false;

      for (const key of Object.keys(index.entries)) {
        const unique = [...new Set(index.entries[key])];
        if (unique.length !== index.entries[key].length) {
          index.entries[key] = unique;
          changed = true;
        }
        if (unique.length === 0) {
          delete index.entries[key];
          removedEmpty++;
          changed = true;
        }
      }

      if (changed) {
        index.entryCount = Object.keys(index.entries).length;
        this.invertedStore.persist(type);
        optimizedTypes++;
      }
    }

    const durationMs = Date.now() - start;
    this.logger.log("info", "optimize", "Index optimization complete", {
      optimizedTypes,
      removedEmpty,
      durationMs,
    });

    return { optimizedTypes, removedEmpty, durationMs };
  }
}
