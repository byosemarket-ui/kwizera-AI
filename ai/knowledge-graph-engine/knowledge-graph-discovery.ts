import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeStorageIndexEntry, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
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
    const entries = knowledgeId
      ? [storage.findIndexEntry(knowledgeId)].filter(Boolean)
      : storage.getIndexEntries();

    this.graph.setBatchPersist(true);
    try {
      for (const entry of entries) {
        if (!entry) continue;

        const read = await storage.getRecord(entry.knowledgeId);
        if (!read.success || !read.record) continue;

        const record = read.record;
        const existing = this.graph.getNode(record.knowledgeId);
        this.graph.ensureKnowledgeNode(
          record.knowledgeId,
          record.knowledgeType,
          record.title,
          record.searchableText
        );
        if (!existing) nodesCreated++;

        discovered += this.discoverExplicitLinks(record);
        discovered += this.discoverMemoryLinks(record);
        discovered += this.discoverTagLinks(record, storage.getIndexEntries());
        discovered += this.discoverTypeAffinity(record, storage.getIndexEntries());
        discovered += this.discoverTopicLinks(record, storage.getIndexEntries());
        discovered += await this.discoverStructuredConceptLinks(record, storage.getIndexEntries());

        void updated;
      }
    } finally {
      this.graph.setBatchPersist(false);
    }

    this.logger.log("info", "discovery", "Knowledge graph discovery complete", {
      discovered,
      nodesCreated,
      knowledgeId,
      durationMs: Date.now() - start,
    });

    return { discovered, updated, nodesCreated, durationMs: Date.now() - start };
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
      for (const entry of allEntries) {
        if (entry.knowledgeId === record.knowledgeId) continue;
        if (!entry.searchableText.includes(tag.toLowerCase())) continue;

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

  private async discoverStructuredConceptLinks(record: KnowledgeRecord, allEntries: KnowledgeStorageIndexEntry[]): Promise<number> {
    const concepts = structuredStrings(record.payload, "concepts");
    if (concepts.length === 0) return 0;

    let count = 0;
    const storage = this.foundation.getStorageEngine();
    for (const entry of allEntries) {
      if (entry.knowledgeId === record.knowledgeId) continue;
      const related = await storage.getRecord(entry.knowledgeId, "knowledge-graph-engine");
      if (!related.success || !related.record) continue;
      const shared = concepts.filter((concept) => structuredStrings(related.record!.payload, "concepts").includes(concept));
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
