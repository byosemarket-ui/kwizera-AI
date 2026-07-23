import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { RelationshipGraphStore } from "./relationship-graph-store.js";
import {
  RelationshipRecommendation,
  RelationshipRecommendations,
  RelationshipType,
} from "./types.js";

export class RelationshipRecommender {
  constructor(private readonly graph: RelationshipGraphStore) {}

  recommend(memoryId: string, limit = 10): RelationshipRecommendations {
    const edges = this.graph.getEdgesFor(memoryId);
    const incoming = this.graph.getAllEdges().filter((e) => e.targetId === memoryId);

    const allEdges = [...edges, ...incoming];
    const recommendations: RelationshipRecommendation[] = [];

    for (const edge of allEdges) {
      const targetId = edge.sourceId === memoryId ? edge.targetId : edge.sourceId;
      const node = this.graph.getGraph().nodes[targetId];
      if (!node) continue;

      recommendations.push({
        memoryId: targetId,
        memoryType: node.memoryType,
        relationshipType: edge.relationshipType,
        strengthScore: edge.strengthScore,
        reason: edge.reason,
      });
    }

    recommendations.sort((a, b) => b.strengthScore - a.strengthScore);

    const unique = new Map<string, RelationshipRecommendation>();
    for (const rec of recommendations) {
      if (!unique.has(rec.memoryId)) unique.set(rec.memoryId, rec);
    }

    const deduped = [...unique.values()].slice(0, limit);

    const result: RelationshipRecommendations = {
      memoryId,
      projects: [],
      videos: [],
      products: [],
      campaigns: [],
      workflows: [],
      learning: [],
      decisions: [],
      knowledge: [],
      all: deduped,
    };

    for (const rec of deduped) {
      switch (rec.memoryType) {
        case MemoryStorageType.Project:
          result.projects.push(rec);
          break;
        case MemoryStorageType.Video:
          result.videos.push(rec);
          break;
        case MemoryStorageType.Product:
          result.products.push(rec);
          break;
        case MemoryStorageType.Marketing:
          result.campaigns.push(rec);
          break;
        case MemoryStorageType.Workflow:
          result.workflows.push(rec);
          break;
        case MemoryStorageType.Learning:
          result.learning.push(rec);
          break;
        case MemoryStorageType.Decision:
          result.decisions.push(rec);
          break;
        case MemoryStorageType.Knowledge:
          result.knowledge.push(rec);
          break;
        default:
          break;
      }
    }

    return result;
  }

  traverse(memoryId: string, maxDepth = 2): string[] {
    const visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: memoryId, depth: 0 }];
    const results: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      if (current.id !== memoryId) results.push(current.id);
      if (current.depth >= maxDepth) continue;

      for (const edge of this.graph.getEdgesFor(current.id)) {
        const next = edge.targetId === current.id ? edge.sourceId : edge.targetId;
        if (!visited.has(next)) {
          queue.push({ id: next, depth: current.depth + 1 });
        }
      }
    }

    return results;
  }
}
