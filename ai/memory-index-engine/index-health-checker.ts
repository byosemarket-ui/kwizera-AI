import { IndexType } from "./types.js";
import { IndexHealthReport } from "./types.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
import { MemoryIndexLogger } from "./index-logger.js";

export class IndexHealthChecker {
  constructor(
    private readonly invertedStore: InvertedIndexStore,
    private readonly relationshipIndex: RelationshipIndex,
    private readonly logger: MemoryIndexLogger
  ) {}

  runCheck(expectedRecordIds: string[]): IndexHealthReport {
    const issues: string[] = [];
    const missingIndexes: string[] = [];
    let duplicateEntries = 0;
    let brokenRelationships = 0;
    let repaired = 0;

    for (const type of Object.values(IndexType)) {
      if (type === IndexType.Related) continue;
      if (!this.invertedStore.verifyChecksum(type)) {
        issues.push(`Checksum failed for index: ${type}`);
      }
      const index = this.invertedStore.getIndex(type);
      if (index.entryCount === 0 && expectedRecordIds.length > 0 && type === IndexType.MemoryId) {
        missingIndexes.push(type);
      }

      for (const ids of Object.values(index.entries)) {
        const unique = new Set(ids);
        if (unique.size !== ids.length) {
          duplicateEntries += ids.length - unique.size;
        }
      }
    }

    if (!this.relationshipIndex.verifyChecksum()) {
      issues.push("Relationship graph checksum failed");
    }

    const graph = this.relationshipIndex.getGraph();
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (!expectedRecordIds.includes(id)) {
        brokenRelationships++;
      }
      for (const relatedId of node.relatedIds) {
        if (!expectedRecordIds.includes(relatedId) && !graph.nodes[relatedId]) {
          brokenRelationships++;
        }
      }
    }

    for (const id of expectedRecordIds) {
      const indexed = this.invertedStore.lookup(IndexType.MemoryId, id);
      if (indexed.length === 0) {
        missingIndexes.push(`memory-id:${id}`);
      }
    }

    const healthy = issues.length === 0 && missingIndexes.length === 0 && brokenRelationships === 0;

    this.logger.log(healthy ? "info" : "warn", "health", "Index health check complete", {
      healthy,
      issues: issues.length,
      missing: missingIndexes.length,
    });

    return {
      healthy,
      integrityValid: issues.length === 0,
      consistencyValid: missingIndexes.length === 0,
      missingIndexes,
      duplicateEntries,
      brokenRelationships,
      issues,
      repaired,
      timestamp: new Date().toISOString(),
    };
  }
}
