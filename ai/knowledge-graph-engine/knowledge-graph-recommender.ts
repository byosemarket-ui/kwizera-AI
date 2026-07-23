import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import {
  KnowledgeGraphRecommendation,
  KnowledgeGraphRecommendations,
  KnowledgeNodeType,
} from "./types.js";

export class KnowledgeGraphRecommender {
  constructor(private readonly graph: KnowledgeGraphStore) {}

  recommend(nodeId: string, limit = 10): KnowledgeGraphRecommendations {
    const outgoing = this.graph.getEdgesFor(nodeId);
    const incoming = this.graph.getAllEdges().filter((e) => e.targetId === nodeId);
    const allEdges = [...outgoing, ...incoming];

    const recommendations: KnowledgeGraphRecommendation[] = [];

    for (const edge of allEdges) {
      const targetId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
      const node = this.graph.getNode(targetId);
      if (!node) continue;

      recommendations.push({
        nodeId: targetId,
        nodeType: node.nodeType,
        relationshipType: edge.relationshipType,
        strengthScore: edge.strengthScore,
        reason: edge.evidence,
      });
    }

    recommendations.sort((a, b) => b.strengthScore - a.strengthScore);

    const unique = new Map<string, KnowledgeGraphRecommendation>();
    for (const rec of recommendations) {
      if (!unique.has(rec.nodeId)) unique.set(rec.nodeId, rec);
    }

    const deduped = [...unique.values()].slice(0, limit);

    const result: KnowledgeGraphRecommendations = {
      sourceId: nodeId,
      products: [],
      videos: [],
      marketing: [],
      brands: [],
      workflows: [],
      decisions: [],
      learning: [],
      memory: [],
      all: deduped,
    };

    for (const rec of deduped) {
      switch (rec.nodeType) {
        case KnowledgeNodeType.Product:
          result.products.push(rec);
          break;
        case KnowledgeNodeType.Video:
          result.videos.push(rec);
          break;
        case KnowledgeNodeType.MarketingCampaign:
          result.marketing.push(rec);
          break;
        case KnowledgeNodeType.Brand:
          result.brands.push(rec);
          break;
        case KnowledgeNodeType.Workflow:
          result.workflows.push(rec);
          break;
        case KnowledgeNodeType.Decision:
          result.decisions.push(rec);
          break;
        case KnowledgeNodeType.Learning:
        case KnowledgeNodeType.Reasoning:
          result.learning.push(rec);
          break;
        case KnowledgeNodeType.MemoryObject:
        case KnowledgeNodeType.Project:
          result.memory.push(rec);
          break;
        default:
          break;
      }
    }

    return result;
  }
}
