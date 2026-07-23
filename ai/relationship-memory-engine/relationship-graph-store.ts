import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import {
  RelationshipEdge,
  RelationshipGraphData,
  RelationshipNode,
  RelationshipType,
  ValidationStatus,
} from "./types.js";

const GRAPH_VERSION = "0.1.0";

export class RelationshipGraphStore {
  private graphPath = "";
  private graph: RelationshipGraphData = {
    version: GRAPH_VERSION,
    lastUpdated: new Date().toISOString(),
    nodes: {},
    edges: {},
    edgeCount: 0,
  };

  initialize(relationshipDir: string): void {
    fs.mkdirSync(relationshipDir, { recursive: true });
    this.graphPath = path.join(relationshipDir, "relationship-graph.json");
    if (fs.existsSync(this.graphPath)) {
      this.graph = JSON.parse(fs.readFileSync(this.graphPath, "utf8")) as RelationshipGraphData;
    } else {
      this.persist();
    }
  }

  getGraph(): RelationshipGraphData {
    return this.graph;
  }

  ensureNode(memoryId: string, memoryType: MemoryStorageType): RelationshipNode {
    if (!this.graph.nodes[memoryId]) {
      this.graph.nodes[memoryId] = { memoryId, memoryType, edgeIds: [] };
    } else {
      this.graph.nodes[memoryId].memoryType = memoryType;
    }
    return this.graph.nodes[memoryId];
  }

  addEdge(edge: RelationshipEdge): boolean {
    const duplicate = Object.values(this.graph.edges).find(
      (e) =>
        e.sourceId === edge.sourceId &&
        e.targetId === edge.targetId &&
        e.relationshipType === edge.relationshipType
    );
    if (duplicate) return false;

    if (!this.graph.nodes[edge.sourceId] || !this.graph.nodes[edge.targetId]) {
      return false;
    }

    this.graph.edges[edge.relationshipId] = edge;
    this.graph.nodes[edge.sourceId].edgeIds.push(edge.relationshipId);
    this.graph.edgeCount = Object.keys(this.graph.edges).length;
    this.graph.lastUpdated = new Date().toISOString();
    this.persist();
    return true;
  }

  updateEdge(relationshipId: string, updates: Partial<RelationshipEdge>): boolean {
    const edge = this.graph.edges[relationshipId];
    if (!edge) return false;
    this.graph.edges[relationshipId] = {
      ...edge,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    this.persist();
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
    this.graph.edgeCount = Object.keys(this.graph.edges).length;
    this.graph.lastUpdated = new Date().toISOString();
    this.persist();
    return true;
  }

  getEdgesFor(memoryId: string): RelationshipEdge[] {
    const node = this.graph.nodes[memoryId];
    if (!node) return [];
    return node.edgeIds
      .map((id) => this.graph.edges[id])
      .filter((e): e is RelationshipEdge => Boolean(e));
  }

  getAllEdges(): RelationshipEdge[] {
    return Object.values(this.graph.edges);
  }

  removeNode(memoryId: string): void {
    const edges = this.getEdgesFor(memoryId);
    for (const edge of edges) {
      this.removeEdge(edge.relationshipId);
    }
    for (const edge of this.getAllEdges()) {
      if (edge.targetId === memoryId) {
        this.removeEdge(edge.relationshipId);
      }
    }
    delete this.graph.nodes[memoryId];
    this.persist();
  }

  createEdge(
    sourceId: string,
    targetId: string,
    sourceType: MemoryStorageType,
    targetType: MemoryStorageType,
    type: RelationshipType,
    reason: string,
    strength: number,
    confidence: number,
    engineSource = "relationship-memory-engine"
  ): RelationshipEdge | null {
    this.ensureNode(sourceId, sourceType);
    this.ensureNode(targetId, targetType);

    const edge: RelationshipEdge = {
      relationshipId: `rel-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      sourceId,
      targetId,
      relationshipType: type,
      strengthScore: strength,
      confidenceScore: confidence,
      creationTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      source: engineSource,
      reason,
      validationStatus: ValidationStatus.Valid,
    };

    return this.addEdge(edge) ? edge : null;
  }

  private persist(): void {
    const content = JSON.stringify(this.graph, null, 2);
    fs.writeFileSync(this.graphPath, content, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    fs.writeFileSync(`${this.graphPath}.sha256`, hash, "utf8");
  }
}
