import type { MemoryRecord } from "../memory-storage-engine/types.js";
import { MemoryRecordStatus } from "../memory-storage-engine/types.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { IndexType } from "./types.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
import { MemoryIndexLogger } from "./index-logger.js";

export class IndexBuilder {
  constructor(
    private readonly invertedStore: InvertedIndexStore,
    private readonly relationshipIndex: RelationshipIndex,
    private readonly logger: MemoryIndexLogger
  ) {}

  indexRecord(record: MemoryRecord, allMemoryIds: string[]): number {
    const start = Date.now();

    if (record.status === MemoryRecordStatus.Deleted) {
      this.removeFromIndexes(record.memoryId);
      return Date.now() - start;
    }

    this.removeFromIndexes(record.memoryId);

    this.invertedStore.addEntry(IndexType.MemoryId, record.memoryId, record.memoryId);

    if (record.relatedProject) {
      this.invertedStore.addEntry(IndexType.Project, record.relatedProject, record.memoryId);
    }

    this.invertedStore.addEntry(IndexType.Category, record.category, record.memoryId);

    for (const tag of record.tags) {
      this.invertedStore.addEntry(IndexType.Tags, tag, record.memoryId);
      if (tag.toLowerCase().includes("brand")) {
        this.invertedStore.addEntry(IndexType.Brand, tag, record.memoryId);
      }
    }

    for (const keyword of record.keywords) {
      this.invertedStore.addEntry(IndexType.Keywords, keyword, record.memoryId);
    }

    if (record.relatedWorkflow) {
      this.invertedStore.addEntry(IndexType.Workflow, record.relatedWorkflow, record.memoryId);
    }

    const dateKey = record.lastUpdate.slice(0, 10);
    this.invertedStore.addEntry(IndexType.Date, dateKey, record.memoryId);

    this.invertedStore.addEntry(IndexType.AiModule, record.source, record.memoryId);

    this.indexByMemoryType(record);

    for (const file of record.relatedFiles) {
      const ext = file.split(".").pop() ?? "unknown";
      this.invertedStore.addEntry(IndexType.FileType, ext, record.memoryId);
    }

    if (record.memoryType === MemoryStorageType.UserPreference) {
      this.invertedStore.addEntry(IndexType.UserPreferences, record.category, record.memoryId);
    }

    if (record.memoryType === MemoryStorageType.Language) {
      this.invertedStore.addEntry(IndexType.Language, record.category, record.memoryId);
    }

    this.relationshipIndex.buildFromRecord(record, allMemoryIds);

    const durationMs = Date.now() - start;
    this.logger.log("info", "create", "Memory indexed", {
      memoryId: record.memoryId,
      durationMs,
    });

    return durationMs;
  }

  removeFromIndexes(memoryId: string): void {
    for (const type of Object.values(IndexType)) {
      if (type !== IndexType.Related) {
        this.invertedStore.removeEntry(type, memoryId);
      }
    }
    this.relationshipIndex.removeNode(memoryId);
    this.logger.log("info", "remove", "Memory removed from indexes", { memoryId });
  }

  private indexByMemoryType(record: MemoryRecord): void {
    const typeMap: Partial<Record<MemoryStorageType, IndexType>> = {
      [MemoryStorageType.Project]: IndexType.Project,
      [MemoryStorageType.Product]: IndexType.Product,
      [MemoryStorageType.Video]: IndexType.Video,
      [MemoryStorageType.Marketing]: IndexType.Marketing,
      [MemoryStorageType.Decision]: IndexType.Decision,
      [MemoryStorageType.Reasoning]: IndexType.Reasoning,
    };

    const indexType = typeMap[record.memoryType];
    if (indexType) {
      this.invertedStore.addEntry(indexType, record.title, record.memoryId);
    }
  }
}
