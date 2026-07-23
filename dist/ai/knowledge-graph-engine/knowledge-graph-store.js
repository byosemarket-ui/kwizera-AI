import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { GraphValidationStatus, mapStorageTypeToNodeType, } from "./types.js";
const GRAPH_VERSION = "0.1.0";
export class KnowledgeGraphStore {
    graphPath = "";
    batchPersist = false;
    graph = {
        version: GRAPH_VERSION,
        lastUpdated: new Date().toISOString(),
        nodes: {},
        edges: {},
        edgeCount: 0,
    };
    initialize(graphDir) {
        fs.mkdirSync(graphDir, { recursive: true });
        this.graphPath = path.join(graphDir, "knowledge-graph.json");
        if (fs.existsSync(this.graphPath)) {
            try {
                this.graph = JSON.parse(fs.readFileSync(this.graphPath, "utf8"));
            }
            catch {
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
        }
        else {
            this.persist();
        }
    }
    setBatchPersist(enabled) {
        this.batchPersist = enabled;
        if (!enabled) {
            this.persist();
        }
    }
    flush() {
        this.persist();
    }
    getGraph() {
        return this.graph;
    }
    ensureKnowledgeNode(knowledgeId, knowledgeType, title, searchableText) {
        const nodeType = mapStorageTypeToNodeType(knowledgeType);
        return this.ensureNode(knowledgeId, nodeType, title, searchableText, knowledgeType);
    }
    ensureNode(nodeId, nodeType, title, searchableText, knowledgeType) {
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
        }
        else {
            const node = this.graph.nodes[nodeId];
            node.nodeType = nodeType;
            node.title = title;
            node.searchableText = searchableText;
            node.knowledgeType = knowledgeType ?? node.knowledgeType;
            node.lastUpdated = new Date().toISOString();
        }
        return this.graph.nodes[nodeId];
    }
    addEdge(edge) {
        const duplicate = Object.values(this.graph.edges).find((e) => e.sourceId === edge.sourceId &&
            e.targetId === edge.targetId &&
            e.relationshipType === edge.relationshipType);
        if (duplicate)
            return false;
        if (!this.graph.nodes[edge.sourceId] || !this.graph.nodes[edge.targetId]) {
            return false;
        }
        this.graph.edges[edge.relationshipId] = edge;
        this.graph.nodes[edge.sourceId].edgeIds.push(edge.relationshipId);
        this.graph.edgeCount = Object.keys(this.graph.edges).length;
        this.graph.lastUpdated = new Date().toISOString();
        if (!this.batchPersist)
            this.persist();
        return true;
    }
    updateEdge(relationshipId, updates) {
        const edge = this.graph.edges[relationshipId];
        if (!edge)
            return false;
        this.graph.edges[relationshipId] = {
            ...edge,
            ...updates,
            lastUpdated: new Date().toISOString(),
        };
        if (!this.batchPersist)
            this.persist();
        return true;
    }
    removeEdge(relationshipId) {
        const edge = this.graph.edges[relationshipId];
        if (!edge)
            return false;
        const sourceNode = this.graph.nodes[edge.sourceId];
        if (sourceNode) {
            sourceNode.edgeIds = sourceNode.edgeIds.filter((id) => id !== relationshipId);
        }
        delete this.graph.edges[relationshipId];
        this.graph.edgeCount = Object.keys(this.graph.edges).length;
        this.graph.lastUpdated = new Date().toISOString();
        if (!this.batchPersist)
            this.persist();
        return true;
    }
    getEdgesFor(nodeId) {
        const node = this.graph.nodes[nodeId];
        if (!node)
            return [];
        return node.edgeIds
            .map((id) => this.graph.edges[id])
            .filter((e) => Boolean(e));
    }
    getAllEdges() {
        return Object.values(this.graph.edges);
    }
    getNode(nodeId) {
        return this.graph.nodes[nodeId];
    }
    getAllNodes() {
        return Object.values(this.graph.nodes);
    }
    removeNode(nodeId) {
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
    createEdge(sourceId, targetId, relationshipType, evidence, strength, confidence, engineSource = "knowledge-graph-engine") {
        if (!this.graph.nodes[sourceId] || !this.graph.nodes[targetId]) {
            return null;
        }
        const edge = {
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
    persist() {
        const content = JSON.stringify(this.graph, null, 2);
        fs.writeFileSync(this.graphPath, content, "utf8");
        const hash = crypto.createHash("sha256").update(content).digest("hex");
        fs.writeFileSync(`${this.graphPath}.sha256`, hash, "utf8");
    }
}
//# sourceMappingURL=knowledge-graph-store.js.map