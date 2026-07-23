import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { KnowledgeGraphDiscovery } from "./knowledge-graph-discovery.js";
import { KnowledgeGraphIntegrityValidator } from "./knowledge-graph-integrity.js";
import { KnowledgeGraphRecommender } from "./knowledge-graph-recommender.js";
import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import { KnowledgeGraphTraverser, KnowledgeGraphSearcher } from "./knowledge-graph-traverser.js";
import { KnowledgeGraphLogger } from "./graph-logger.js";
import {
  GraphIntegrityReport,
  GraphPathResult,
  KnowledgeGraphData,
  KnowledgeGraphDiscoveryResult,
  KnowledgeGraphEdge,
  KnowledgeGraphEngineError,
  KnowledgeGraphNode,
  KnowledgeGraphRecommendations,
  KnowledgeGraphStatusReport,
  KnowledgeNodeType,
  KnowledgeRelationType,
  GraphValidationStatus,
} from "./types.js";

export interface CreateKnowledgeRelationshipInput {
  sourceId: string;
  targetId: string;
  relationshipType: KnowledgeRelationType;
  evidence: string;
  strengthScore?: number;
  confidenceScore?: number;
}

/**
 * Knowledge Graph Engine — central intelligence network for knowledge relationships.
 */
export class AiKnowledgeGraphEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new KnowledgeGraphLogger();
  readonly graph = new KnowledgeGraphStore();

  private discovery: KnowledgeGraphDiscovery | null = null;
  private integrity: KnowledgeGraphIntegrityValidator | null = null;
  private recommender: KnowledgeGraphRecommender | null = null;
  private traverser: KnowledgeGraphTraverser | null = null;
  private searcher: KnowledgeGraphSearcher | null = null;

  private discoveryTimes: number[] = [];
  private traversalTimes: number[] = [];
  private searchTimes: number[] = [];
  private recommendationTimes: number[] = [];
  private lastIntegrityMs = 0;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const graphDir = path.join(storageRoot, "knowledge", "graph");
    this.logger.initialize(logDir);
    this.graph.initialize(graphDir);

    this.discovery = new KnowledgeGraphDiscovery(foundation, this.graph, this.logger);
    this.integrity = new KnowledgeGraphIntegrityValidator(foundation, this.graph, this.logger);
    this.recommender = new KnowledgeGraphRecommender(this.graph);
    this.traverser = new KnowledgeGraphTraverser(this.graph);
    this.searcher = new KnowledgeGraphSearcher(this.graph);

    this.initialized = true;
    this.logger.log("info", "startup", "Knowledge Graph Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!.getStorageEngine().getIndexEntries();
    for (const entry of entries) {
      this.graph.ensureKnowledgeNode(
        entry.knowledgeId,
        entry.knowledgeType,
        entry.title,
        entry.searchableText
      );
    }

    await this.discoverRelationships();
    const integrityReport = this.validateIntegrity();
    this.lastIntegrityMs = integrityReport.durationMs;

    this.startupComplete = true;
    this.logger.log("info", "startup", "Knowledge Graph Engine startup complete", {
      nodes: Object.keys(this.graph.getGraph().nodes).length,
      edges: this.graph.getGraph().edgeCount,
      durationMs: Date.now() - start,
    });
  }

  async evolveGraph(knowledgeId: string): Promise<KnowledgeGraphDiscoveryResult> {
    this.ensureReady();
    this.logger.log("info", "evolution", "Evolving graph from knowledge change", { knowledgeId });
    return this.discoverRelationships(knowledgeId);
  }

  async removeKnowledgeFromGraph(knowledgeId: string): Promise<void> {
    this.ensureReady();
    this.graph.removeNode(knowledgeId);
    this.logger.log("info", "evolution", "Removed knowledge from graph", { knowledgeId });
  }

  async discoverRelationships(knowledgeId?: string): Promise<KnowledgeGraphDiscoveryResult> {
    this.ensureReady();
    const start = Date.now();
    const result = await this.discovery!.discover(knowledgeId);
    this.discoveryTimes.push(Date.now() - start);
    return result;
  }

  createRelationship(input: CreateKnowledgeRelationshipInput): KnowledgeGraphEdge | null {
    this.ensureReady();
    this.validateRelationshipInput(input);

    const edge = this.graph.createEdge(
      input.sourceId,
      input.targetId,
      input.relationshipType,
      input.evidence,
      input.strengthScore ?? 70,
      input.confidenceScore ?? 80
    );

    if (edge) {
      this.logger.log("info", "relationship", "Knowledge relationship created", {
        relationshipId: edge.relationshipId,
        type: edge.relationshipType,
      });
    }
    return edge;
  }

  createNode(
    nodeId: string,
    nodeType: KnowledgeNodeType,
    title: string,
    searchableText: string
  ): KnowledgeGraphNode {
    this.ensureReady();
    const node = this.graph.ensureNode(nodeId, nodeType, title, searchableText);
    this.logger.log("info", "node", "Knowledge graph node created", { nodeId, nodeType });
    return node;
  }

  updateRelationship(
    relationshipId: string,
    updates: Partial<Pick<KnowledgeGraphEdge, "strengthScore" | "confidenceScore" | "evidence" | "validationStatus">>
  ): boolean {
    this.ensureReady();
    const updated = this.graph.updateEdge(relationshipId, updates);
    if (updated) {
      this.logger.log("info", "relationship", "Relationship updated", { relationshipId });
    }
    return updated;
  }

  removeRelationship(relationshipId: string): boolean {
    this.ensureReady();
    const removed = this.graph.removeEdge(relationshipId);
    if (removed) {
      this.logger.log("info", "relationship", "Relationship removed", { relationshipId });
    }
    return removed;
  }

  getRelationships(nodeId: string): KnowledgeGraphEdge[] {
    this.ensureReady();
    const outgoing = this.graph.getEdgesFor(nodeId);
    const incoming = this.graph
      .getAllEdges()
      .filter((e) => e.targetId === nodeId && !outgoing.some((o) => o.relationshipId === e.relationshipId));
    return [...outgoing, ...incoming];
  }

  getRecommendations(nodeId: string, limit = 10): KnowledgeGraphRecommendations {
    this.ensureReady();
    const start = Date.now();
    const result = this.recommender!.recommend(nodeId, limit);
    this.recommendationTimes.push(Date.now() - start);
    this.logger.log("info", "recommendation", "Graph recommendations generated", {
      nodeId,
      count: result.all.length,
    });
    return result;
  }

  traverse(nodeId: string, maxDepth = 2): string[] {
    this.ensureReady();
    const start = Date.now();
    const result = this.traverser!.traverse(nodeId, maxDepth);
    this.traversalTimes.push(Date.now() - start);
    return result;
  }

  neighborhood(nodeId: string, depth = 1): string[] {
    this.ensureReady();
    return this.traverser!.neighborhood(nodeId, depth);
  }

  shortestPath(sourceId: string, targetId: string): GraphPathResult {
    this.ensureReady();
    const start = Date.now();
    const result = this.traverser!.shortestPath(sourceId, targetId);
    this.searchTimes.push(Date.now() - start);
    return result;
  }

  findPath(sourceId: string, targetId: string, maxDepth = 4): GraphPathResult {
    this.ensureReady();
    const start = Date.now();
    const result = this.traverser!.findPath(sourceId, targetId, maxDepth);
    this.searchTimes.push(Date.now() - start);
    return result;
  }

  searchNodes(query: Parameters<KnowledgeGraphSearcher["searchNodes"]>[0]): KnowledgeGraphNode[] {
    this.ensureReady();
    const start = Date.now();
    const result = this.searcher!.searchNodes(query);
    this.searchTimes.push(Date.now() - start);
    return result;
  }

  searchRelationships(
    query: Parameters<KnowledgeGraphSearcher["searchRelationships"]>[0]
  ): KnowledgeGraphEdge[] {
    this.ensureReady();
    const start = Date.now();
    const result = this.searcher!.searchRelationships(query);
    this.searchTimes.push(Date.now() - start);
    return result;
  }

  similaritySearch(nodeId: string, limit = 10): KnowledgeGraphNode[] {
    this.ensureReady();
    const start = Date.now();
    const result = this.searcher!.similaritySearch(nodeId, limit);
    this.searchTimes.push(Date.now() - start);
    return result;
  }

  validateIntegrity(): GraphIntegrityReport {
    this.ensureReady();
    const report = this.integrity!.validateAndRepair();
    this.lastIntegrityMs = report.durationMs;
    return report;
  }

  optimizeGraph(): { nodesRemoved: number; edgesRemoved: number } {
    this.ensureReady();
    const start = Date.now();
    const storage = this.foundation!.getStorageEngine();
    let nodesRemoved = 0;

    for (const nodeId of Object.keys(this.graph.getGraph().nodes)) {
      const node = this.graph.getNode(nodeId);
      if (node?.knowledgeType && !storage.findIndexEntry(nodeId)) {
        this.graph.removeNode(nodeId);
        nodesRemoved++;
      }
    }

    const integrity = this.validateIntegrity();

    this.logger.log("info", "optimization", "Graph optimization complete", {
      nodesRemoved,
      edgesRemoved: integrity.issuesRepaired,
      durationMs: Date.now() - start,
    });

    return { nodesRemoved, edgesRemoved: integrity.issuesRepaired };
  }

  getGraph(): KnowledgeGraphData {
    this.ensureReady();
    return this.graph.getGraph();
  }

  buildStatusReport(): KnowledgeGraphStatusReport {
    const graph = this.graph.getGraph();
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    const validEdges = this.graph
      .getAllEdges()
      .filter((e) => e.validationStatus === GraphValidationStatus.Valid).length;
    const totalEdges = graph.edgeCount;
    const recommendationQuality =
      totalEdges > 0 ? `${Math.round((validEdges / totalEdges) * 100)}% evidence-validated edges` : "awaiting relationships";

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      graphStatus: `${Object.keys(graph.nodes).length} nodes, ${graph.edgeCount} relationships`,
      nodeCount: Object.keys(graph.nodes).length,
      relationshipCount: graph.edgeCount,
      graphIntegrity: validEdges === totalEdges ? "verified" : "partial validation",
      recommendationQuality,
      performance: {
        averageDiscoveryMs: avg(this.discoveryTimes),
        averageTraversalMs: avg(this.traversalTimes),
        averageSearchMs: avg(this.searchTimes),
        averageRecommendationMs: avg(this.recommendationTimes),
        lastIntegrityCheckMs: this.lastIntegrityMs,
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  private validateRelationshipInput(input: CreateKnowledgeRelationshipInput): void {
    if (!input.evidence || input.evidence.trim() === "") {
      throw new KnowledgeGraphEngineError(
        "Relationships require evidence",
        "MISSING_EVIDENCE"
      );
    }

    const storage = this.foundation!.getStorageEngine();
    const sourceNode = this.graph.getNode(input.sourceId);
    const targetNode = this.graph.getNode(input.targetId);

    if (sourceNode?.knowledgeType && !storage.findIndexEntry(input.sourceId)) {
      throw new KnowledgeGraphEngineError(`Source knowledge not found: ${input.sourceId}`, "INVALID_SOURCE");
    }
    if (targetNode?.knowledgeType && !storage.findIndexEntry(input.targetId)) {
      throw new KnowledgeGraphEngineError(`Target knowledge not found: ${input.targetId}`, "INVALID_TARGET");
    }
    if (!sourceNode || !targetNode) {
      throw new KnowledgeGraphEngineError("Both graph nodes must exist", "INVALID_NODE");
    }
    if (input.sourceId === input.targetId) {
      throw new KnowledgeGraphEngineError("Self-referencing relationships are not allowed", "INVALID_SELF_REFERENCE");
    }
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new KnowledgeGraphEngineError("Knowledge Graph Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
