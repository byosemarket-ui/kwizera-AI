import type { AiMemoryStorageEngine } from "../memory-storage-engine/memory-storage-engine.js";
import { IndexRebuildResult } from "./types.js";
import { IndexBuilder } from "./index-builder.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
import { MemoryIndexLogger } from "./index-logger.js";

export class IndexRebuilder {
  constructor(
    private readonly invertedStore: InvertedIndexStore,
    private readonly relationshipIndex: RelationshipIndex,
    private readonly indexBuilder: IndexBuilder,
    private readonly logger: MemoryIndexLogger
  ) {}

  async rebuild(storageEngine: AiMemoryStorageEngine): Promise<IndexRebuildResult> {
    const start = Date.now();
    this.logger.log("info", "rebuild", "Starting full index rebuild");

    this.invertedStore.clearAll();
    this.relationshipIndex.clear();

    const entries = storageEngine.getIndexEntries();
    const allIds = entries.map((e) => e.memoryId);
    let indexed = 0;
    let relationships = 0;

    for (const entry of entries) {
      const read = await storageEngine.getRecord(entry.memoryId, "memory-index-engine");
      if (read.success && read.record) {
        this.indexBuilder.indexRecord(read.record, allIds);
        indexed++;
        relationships += this.relationshipIndex.getRelated(entry.memoryId).length;
      }
    }

    const durationMs = Date.now() - start;
    this.logger.log("info", "rebuild", "Index rebuild complete", {
      indexed,
      relationships,
      durationMs,
    });

    return {
      success: true,
      recordsIndexed: indexed,
      relationshipsBuilt: relationships,
      durationMs,
      dataProtected: true,
    };
  }
}
