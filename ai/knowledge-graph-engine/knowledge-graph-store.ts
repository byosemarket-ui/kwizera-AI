import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import type { KnowledgeStorageIndexEntry } from "../knowledge-storage-engine/types.js";
import {
  GraphValidationStatus,
  KnowledgeGraphData,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeNodeType,
  KnowledgeRelationType,
  mapStorageTypeToNodeType,
} from "./types.js";

const GRAPH_VERSION = "0.1.0";

interface GraphDiscoveryState {
  version: 1;
  fingerprint: string;
  recordCount: number;
  completedAt: string;
}

export class KnowledgeGraphStore {
  private graphPath = "";
  private discoveryStatePath = "";
  private batchPersist = false;
  private edgeKeys = new Set<string>();
  private graph: KnowledgeGraphData = {
    version: GRAPH_VERSION,
    lastUpdated: new Date().toISOString(),
    nodes: {},
    edges: {},
    edgeCount: 0,
  };

  initialize(graphDir: string): void {
    fs.mkdirSync(graphDir, { recursive: true });
    this.graphPath = path.join(graphDir, "knowledge-graph.json");
    this.discoveryStatePath = path.join(graphDir, "discovery-state.json");
    if (fs.existsSync(this.graphPath)) {
      try {
        this.graph = JSON.parse(fs.readFileSync(this.graphPath, "utf8")) as KnowledgeGraphData;
      } catch {
        const backupPath = `${this.graphPath}.corrupt-${Date.now()}.bak`;
        fs.copyFileSync(this.graphPath, backupPath);
        this.graph = {
          version: GRAPH_VERSION,
          lastUpdated: new Date().toISOString(),
          nodes: {},
          edges: {},
          edgeCount: 0,
        };
        this.persist();
      }
    } else {
      this.persist();
    }
    this.rebuildEdgeIndex();
  }

  computeIndexFingerprint(entries: KnowledgeStorageIndexEntry[]): string {
    return entries
      .map((entry) => `${entry.knowledgeId}:${entry.contentHash}:${entry.version}`)
      .sort()
      .join("\n");
  }

  canReuseDiscovery(fingerprint: string, knowledgeIds: string[]): boolean {
    if (!this.discoveryStatePath || !fs.existsSync(this.discoveryStatePath)) {
      return false;
    }
    try {
      const state = JSON.parse(fs.readFileSync(this.discoveryStatePath, "utf8")) as GraphDiscoveryState;
      if (state.version !== 1 || state.fingerprint !== fingerprint) {
        return false;
      }
      return knowledgeIds.every((id) => Boolean(this.graph.nodes[id]));
    } catch {
      return false;
    }
  }

  markDiscoveryComplete(fingerprint: string, recordCount: number): void {
    if (!this.discoveryStatePath) return;
    const state: GraphDiscoveryState = {
      version: 1,
      fingerprint,
      recordCount,
      completedAt: new Date().toISOString(),
    };
    fs.writeFileSync(this.discoveryStatePath, JSON.stringify(state, null, 2), "utf8");
  }

  isBatchPersist(): boolean {
    return this.batchPersist;
  }

  setBatchPersist(enabled: boolean): void {
    this.batchPersist = enabled;
    if (!enabled) {
      this.persist();
    }
  }

  flush(): void {
    this.persist();
  }

  getGraph(): KnowledgeGraphData {
    return this.graph;
  }

  ensureKnowledgeNode(
    knowledgeId: string,
    knowledgeType: KnowledgeStorageType,
    title: string,
    searchableText: string
  ): KnowledgeGraphNode {
    const nodeType = mapStorageTypeToNodeType(knowledgeType);
    return this.ensureNode(knowledgeId, nodeType, title, searchableText, knowledgeType);
  }

  ensureNode(
    nodeId: string,
    nodeType: KnowledgeNodeType,
    title: string,
    searchableText: string,
    knowledgeType?: KnowledgeStorageType
  ): KnowledgeGraphNode {
    if (!this.graph.nodes[nodeId]) {
      this.graph.nodes[nodeId] = {
        nodeId,
        nodeType,
        knowledgeType,
        title,
        edgeIds: [],
        searchableText,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      const node = this.graph.nodes[nodeId];
      node.nodeType = nodeType;
      node.title = title;
      node.searchableText = searchableText;
      node.knowledgeType = knowledgeType ?? node.knowledgeType;
      node.lastUpdated = new Date().toISOString();
    }
    return this.graph.nodes[nodeId];
  }

  addEdge(edge: KnowledgeGraphEdge): boolean {
    const key = this.edgeKey(edge.sourceId, edge.targetId, edge.relationshipType);
    if (this.edgeKeys.has(key)) return false;

    if (!this.graph.nodes[edge.sourceId] || !this.graph.nodes[edge.targetId]) {
      return false;
    }

    this.graph.edges[edge.relationshipId] = edge;
    this.graph.nodes[edge.sourceId].edgeIds.push(edge.relationshipId);
    this.edgeKeys.add(key);
    this.graph.edgeCount += 1;
    this.graph.lastUpdated = new Date().toISOString();
    if (!this.batchPersist) this.persist();
    return true;
  }

  updateEdge(relationshipId: string, updates: Partial<KnowledgeGraphEdge>): boolean {
    const edge = this.graph.edges[relationshipId];
    if (!edge) return false;
    this.graph.edges[relationshipId] = {
      ...edge,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    if (!this.batchPersist) this.persist();
    return true;
  }

  removeEdge(relationshipId: string): boolean {
    const edge = this.graph.edges[relationshipId];
    if (!edge) return false;

    const sourceNode = this.graph.nodes[edge.sourceId];
    if (sourceNode) {
      sourceNode.edgeIds = sourceNode.edgeIds.filter((id) => id !== relationshipId);
    }

    delete this.graph.edges[relationshipId];
    this.edgeKeys.delete(this.edgeKey(edge.sourceId, edge.targetId, edge.relationshipType));
    this.graph.edgeCount = Math.max(0, this.graph.edgeCount - 1);
    this.graph.lastUpdated = new Date().toISOString();
    if (!this.batchPersist) this.persist();
    return true;
  }

  getEdgesFor(nodeId: string): KnowledgeGraphEdge[] {
    const node = this.graph.nodes[nodeId];
    if (!node) return [];
    return node.edgeIds
      .map((id) => this.graph.edges[id])
      .filter((e): e is KnowledgeGraphEdge => Boolean(e));
  }

  getAllEdges(): KnowledgeGraphEdge[] {
    return Object.values(this.graph.edges);
  }

  getNode(nodeId: string): KnowledgeGraphNode | undefined {
    return this.graph.nodes[nodeId];
  }

  getAllNodes(): KnowledgeGraphNode[] {
    return Object.values(this.graph.nodes);
  }

  removeNode(nodeId: string): void {
    const edges = this.getEdgesFor(nodeId);
    for (const edge of edges) {
      this.removeEdge(edge.relationshipId);
    }
    for (const edge of this.getAllEdges()) {
      if (edge.targetId === nodeId) {
        this.removeEdge(edge.relationshipId);
      }
    }
    delete this.graph.nodes[nodeId];
    this.persist();
  }

  createEdge(
    sourceId: string,
    targetId: string,
    relationshipType: KnowledgeRelationType,
    evidence: string,
    strength: number,
    confidence: number,
    engineSource = "knowledge-graph-engine"
  ): KnowledgeGraphEdge | null {
    if (!this.graph.nodes[sourceId] || !this.graph.nodes[targetId]) {
      return null;
    }
    if (this.edgeKeys.has(this.edgeKey(sourceId, targetId, relationshipType))) {
      return null;
    }

    const edge: KnowledgeGraphEdge = {
      relationshipId: `krel-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      sourceId,
      targetId,
      relationshipType,
      strengthScore: strength,
      confidenceScore: confidence,
      evidence,
      source: engineSource,
      creationTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      validationStatus: GraphValidationStatus.Valid,
    };

    return this.addEdge(edge) ? edge : null;
  }

  private edgeKey(sourceId: string, targetId: string, relationshipType: KnowledgeRelationType): string {
    return `${sourceId}\0${targetId}\0${relationshipType}`;
  }

  private rebuildEdgeIndex(): void {
    this.edgeKeys.clear();
    const edges = Object.values(this.graph.edges);
    this.graph.edgeCount = edges.length;
    for (const edge of edges) {
      this.edgeKeys.add(this.edgeKey(edge.sourceId, edge.targetId, edge.relationshipType));
    }
  }

  private persist(): void {
    const content = JSON.stringify(this.graph);
    fs.writeFileSync(this.graphPath, content, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    fs.writeFileSync(`${this.graphPath}.sha256`, hash, "utf8");
  }
}
