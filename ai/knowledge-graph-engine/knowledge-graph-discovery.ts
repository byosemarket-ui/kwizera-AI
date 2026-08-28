import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeStorageIndexEntry, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import { yieldEventLoop } from "../../config/yield-event-loop.js";
import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import { KnowledgeGraphLogger } from "./graph-logger.js";
import { KnowledgeGraphDiscoveryResult, KnowledgeNodeType, KnowledgeRelationType } from "./types.js";

const TYPE_AFFINITY: Partial<Record<KnowledgeStorageType, KnowledgeStorageType[]>> = {
  [KnowledgeStorageType.Product]: [
    KnowledgeStorageType.Marketing,
    KnowledgeStorageType.Video,
    KnowledgeStorageType.Brand,
    KnowledgeStorageType.Image,
  ],
  [KnowledgeStorageType.Video]: [KnowledgeStorageType.Marketing, KnowledgeStorageType.Product, KnowledgeStorageType.Creative],
  [KnowledgeStorageType.Decision]: [KnowledgeStorageType.Reasoning, KnowledgeStorageType.Workflow],
  [KnowledgeStorageType.Reasoning]: [KnowledgeStorageType.Decision, KnowledgeStorageType.Industry],
  [KnowledgeStorageType.Marketing]: [KnowledgeStorageType.Product, KnowledgeStorageType.Brand],
  [KnowledgeStorageType.Workflow]: [KnowledgeStorageType.Decision, KnowledgeStorageType.Technical],
};

/**
 * Relationship discovery must stay O(records) on disk.
 * Loading every peer with getRecord() inside the per-record loop is O(n²) filesystem
 * reads, JSON parses, access-history appends, and event-loop starvation.
 */
export class KnowledgeGraphDiscovery {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly graph: KnowledgeGraphStore,
    private readonly logger: KnowledgeGraphLogger
  ) {}

  async discover(knowledgeId?: string): Promise<KnowledgeGraphDiscoveryResult> {
    const start = Date.now();
    let discovered = 0;
    let updated = 0;
    let nodesCreated = 0;

    const storage = this.foundation.getStorageEngine();
    const allEntries = storage.getIndexEntries();
    const entries = knowledgeId
      ? [storage.findIndexEntry(knowledgeId)].filter(Boolean)
      : allEntries;

    const manageBatch = !this.graph.isBatchPersist();
    if (manageBatch) {
      this.graph.setBatchPersist(true);
    }

    try {
      if (knowledgeId) {
        const recordRead = await storage.getRecord(knowledgeId, "knowledge-graph-engine", { skipAudit: true });
        if (recordRead.success && recordRead.record) {
          const record = recordRead.record;
          const existing = this.graph.getNode(record.knowledgeId);
          this.graph.ensureKnowledgeNode(
            record.knowledgeId,
            record.knowledgeType,
            record.title,
            record.searchableText
          );
          if (!existing) nodesCreated++;
          discovered += this.linkRecord(record, allEntries, null);
        }
      } else {
        process.stdout.write(
          `[KWIZERA] Knowledge Graph discovery: loading ${allEntries.length} records once\n`
        );
        const recordsById = await this.loadCorpusOnce(allEntries);
        let processed = 0;
        for (const entry of entries) {
          if (!entry) continue;
          const record = recordsById.get(entry.knowledgeId);
          if (!record) continue;

          const existing = this.graph.getNode(record.knowledgeId);
          this.graph.ensureKnowledgeNode(
            record.knowledgeId,
            record.knowledgeType,
            record.title,
            record.searchableText
          );
          if (!existing) nodesCreated++;
          discovered += this.linkRecord(record, allEntries, recordsById);

          processed++;
          if (processed % 4 === 0) {
            await yieldEventLoop();
          }
          if (processed % 50 === 0) {
            process.stdout.write(
              `[KWIZERA] Knowledge Graph discovery: ${processed}/${entries.length} records linked\n`
            );
          }
        }
      }
    } finally {
      if (manageBatch) {
        this.graph.setBatchPersist(false);
      }
    }

    void updated;

    if (!knowledgeId) {
      this.logger.log("info", "discovery", "Knowledge graph discovery complete", {
        discovered,
        nodesCreated,
        durationMs: Date.now() - start,
      });
      process.stdout.write(
        `[KWIZERA] Knowledge Graph discovery: complete (${discovered} new edges, ${Date.now() - start}ms)\n`
      );
    }

    return { discovered, updated, nodesCreated, durationMs: Date.now() - start };
  }

  private async loadCorpusOnce(allEntries: KnowledgeStorageIndexEntry[]): Promise<Map<string, KnowledgeRecord>> {
    const storage = this.foundation.getStorageEngine();
    const recordsById = new Map<string, KnowledgeRecord>();
    let loaded = 0;

    for (const entry of allEntries) {
      const read = await storage.getRecord(entry.knowledgeId, "knowledge-graph-engine", { skipAudit: true });
      if (read.success && read.record) {
        recordsById.set(entry.knowledgeId, read.record);
      }
      loaded++;
      if (loaded % 8 === 0) {
        await yieldEventLoop();
      }
      if (loaded % 40 === 0) {
        process.stdout.write(
          `[KWIZERA] Knowledge Graph discovery: loaded ${loaded}/${allEntries.length} records\n`
        );
      }
    }

    return recordsById;
  }

  private linkRecord(
    record: KnowledgeRecord,
    allEntries: KnowledgeStorageIndexEntry[],
    recordsById: Map<string, KnowledgeRecord> | null
  ): number {
    let discovered = 0;
    discovered += this.discoverExplicitLinks(record);
    discovered += this.discoverMemoryLinks(record);
    discovered += this.discoverTagLinks(record, allEntries);
    discovered += this.discoverTypeAffinity(record, allEntries);
    discovered += this.discoverTopicLinks(record, allEntries);
    if (recordsById) {
      discovered += this.discoverStructuredConceptLinks(record, allEntries, recordsById);
    } else {
      discovered += this.discoverStructuredConceptLinksFromIndex(record, allEntries);
    }
    return discovered;
  }

  private discoverExplicitLinks(record: KnowledgeRecord): number {
    let count = 0;
    for (const relatedId of record.relatedKnowledge) {
      if (relatedId === record.knowledgeId) continue;
      const edge = this.graph.createEdge(
        record.knowledgeId,
        relatedId,
        KnowledgeRelationType.RelatedTo,
        `Explicit relatedKnowledge link on ${record.knowledgeId}`,
        85,
        90
      );
      if (edge) count++;
    }
    return count;
  }

  private discoverMemoryLinks(record: KnowledgeRecord): number {
    let count = 0;
    for (const memoryId of record.relatedMemory) {
      const nodeType = memoryId.includes("project")
        ? KnowledgeNodeType.Project
        : KnowledgeNodeType.MemoryObject;

      this.graph.ensureNode(memoryId, nodeType, memoryId, memoryId.toLowerCase());

      const edge = this.graph.createEdge(
        record.knowledgeId,
        memoryId,
        KnowledgeRelationType.BelongsTo,
        `Knowledge linked to memory object: ${memoryId}`,
        75,
        85
      );
      if (edge) count++;
    }
    return count;
  }

  private discoverTagLinks(record: KnowledgeRecord, allEntries: KnowledgeStorageIndexEntry[]): number {
    let count = 0;
    for (const tag of record.tags) {
      const needle = tag.toLowerCase();
      for (const entry of allEntries) {
        if (entry.knowledgeId === record.knowledgeId) continue;
        if (!entry.searchableText.includes(needle)) continue;

        const edge = this.graph.createEdge(
          record.knowledgeId,
          entry.knowledgeId,
          KnowledgeRelationType.FrequentlyUsedTogether,
          `Shared tag evidence: ${tag}`,
          60,
          75
        );
        if (edge) count++;
      }
    }
    return count;
  }

  private discoverTypeAffinity(record: KnowledgeRecord, allEntries: KnowledgeStorageIndexEntry[]): number {
    let count = 0;
    const relatedTypes = TYPE_AFFINITY[record.knowledgeType] ?? [];

    for (const entry of allEntries) {
      if (entry.knowledgeId === record.knowledgeId) continue;
      if (!relatedTypes.includes(entry.knowledgeType)) continue;

      const sharedKeywords = record.keywords.filter((k) =>
        entry.searchableText.includes(k.toLowerCase())
      );
      if (sharedKeywords.length === 0 && record.category !== entry.searchableText.split(" ")[0]) {
        continue;
      }

      const edge = this.graph.createEdge(
        record.knowledgeId,
        entry.knowledgeId,
        KnowledgeRelationType.RecommendedWith,
        `Type affinity ${record.knowledgeType} → ${entry.knowledgeType}`,
        55 + sharedKeywords.length * 5,
        70
      );
      if (edge) count++;
    }
    return count;
  }

  private discoverTopicLinks(record: KnowledgeRecord, allEntries: KnowledgeStorageIndexEntry[]): number {
    let count = 0;
    const topic = record.classification.topic.toLowerCase();
    if (!topic) return 0;

    for (const entry of allEntries) {
      if (entry.knowledgeId === record.knowledgeId) continue;
      if (entry.topic.toLowerCase() !== topic && !entry.searchableText.includes(topic)) continue;

      const edge = this.graph.createEdge(
        record.knowledgeId,
        entry.knowledgeId,
        KnowledgeRelationType.SimilarTo,
        `Shared topic: ${topic}`,
        65,
        80
      );
      if (edge) count++;
    }
    return count;
  }

  private discoverStructuredConceptLinks(
    record: KnowledgeRecord,
    allEntries: KnowledgeStorageIndexEntry[],
    recordsById: Map<string, KnowledgeRecord>
  ): number {
    const concepts = structuredStrings(record.payload, "concepts");
    if (concepts.length === 0) return 0;

    let count = 0;
    for (const entry of allEntries) {
      if (entry.knowledgeId === record.knowledgeId) continue;
      const related = recordsById.get(entry.knowledgeId);
      if (!related) continue;
      const shared = concepts.filter((concept) => structuredStrings(related.payload, "concepts").includes(concept));
      if (shared.length === 0) continue;

      const edge = this.graph.createEdge(
        record.knowledgeId,
        entry.knowledgeId,
        KnowledgeRelationType.SimilarTo,
        `Shared structured concepts: ${shared.join(", ")}`,
        Math.min(90, 60 + shared.length * 10),
        Math.min(95, 75 + shared.length * 5)
      );
      if (edge) count++;
    }
    return count;
  }

  private discoverStructuredConceptLinksFromIndex(
    record: KnowledgeRecord,
    allEntries: KnowledgeStorageIndexEntry[]
  ): number {
    const concepts = structuredStrings(record.payload, "concepts");
    if (concepts.length === 0) return 0;

    let count = 0;
    for (const entry of allEntries) {
      if (entry.knowledgeId === record.knowledgeId) continue;
      const shared = concepts.filter((concept) => entry.searchableText.includes(concept));
      if (shared.length === 0) continue;

      const edge = this.graph.createEdge(
        record.knowledgeId,
        entry.knowledgeId,
        KnowledgeRelationType.SimilarTo,
        `Shared structured concepts: ${shared.join(", ")}`,
        Math.min(90, 60 + shared.length * 10),
        Math.min(95, 75 + shared.length * 5)
      );
      if (edge) count++;
    }
    return count;
  }
}

function structuredStrings(payload: Record<string, unknown> | undefined, field: string): string[] {
  const value = payload?.[field];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase())
    : [];
}
