import path from "node:path";
import { MemoryAccessPermission, MemoryCategory, MemoryModuleStatus } from "../memory-foundation/types.js";
import { RelationshipDiscovery } from "./relationship-discovery.js";
import { RelationshipGraphStore } from "./relationship-graph-store.js";
import { RelationshipIntegrityValidator } from "./relationship-integrity.js";
import { RelationshipMemoryLogger } from "./relationship-logger.js";
import { RelationshipRecommender } from "./relationship-recommender.js";
import { RelationshipMemoryEngineError, RelationshipType, ValidationStatus, } from "./types.js";
/**
 * Relationship Memory Engine — central graph for intelligent memory connections.
 */
export class AiRelationshipMemoryEngine {
    foundation = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new RelationshipMemoryLogger();
    graph = new RelationshipGraphStore();
    discovery = null;
    integrity = null;
    recommender = null;
    discoveryTimes = [];
    traversalTimes = [];
    recommendationTimes = [];
    lastIntegrityMs = 0;
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const relationshipDir = path.join(storageRoot, "memory", "relationships");
        this.logger.initialize(logDir);
        this.graph.initialize(relationshipDir);
        this.discovery = new RelationshipDiscovery(foundation, this.graph, this.logger);
        this.integrity = new RelationshipIntegrityValidator(foundation, this.graph, this.logger);
        this.recommender = new RelationshipRecommender(this.graph);
        this.initialized = true;
        this.logger.log("info", "startup", "Relationship Memory Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        const entries = this.foundation.getStorageEngine().getIndexEntries();
        for (const entry of entries) {
            this.graph.ensureNode(entry.memoryId, entry.memoryType);
        }
        await this.discoverRelationships();
        const integrityReport = this.validateIntegrity();
        this.lastIntegrityMs = integrityReport.durationMs;
        this.foundation.registerMemoryModule({
            memoryId: "persistent-memory",
            memoryName: "Relationship Memory",
            category: MemoryCategory.Persistent,
            version: "0.1.0",
            status: MemoryModuleStatus.Active,
            dependencies: ["memory-engine"],
            storageLocation: path.join(this.storageRoot, "memory", "relationships"),
            accessPermissions: [
                MemoryAccessPermission.Read,
                MemoryAccessPermission.Write,
                MemoryAccessPermission.Update,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Relationship Memory Engine startup complete", {
            nodes: Object.keys(this.graph.getGraph().nodes).length,
            edges: this.graph.getGraph().edgeCount,
            durationMs: Date.now() - start,
        });
    }
    async discoverRelationships(memoryId) {
        this.ensureReady();
        const start = Date.now();
        const result = await this.discovery.discover(memoryId);
        this.discoveryTimes.push(Date.now() - start);
        return result;
    }
    createRelationship(input) {
        this.ensureReady();
        this.validateRelationshipInput(input);
        const edge = this.graph.createEdge(input.sourceId, input.targetId, input.sourceType, input.targetType, input.relationshipType, input.reason, input.strengthScore ?? 70, input.confidenceScore ?? 80);
        if (edge) {
            this.logger.log("info", "create", "Relationship created", {
                relationshipId: edge.relationshipId,
                type: edge.relationshipType,
            });
        }
        return edge;
    }
    updateRelationship(relationshipId, updates) {
        this.ensureReady();
        const updated = this.graph.updateEdge(relationshipId, updates);
        if (updated) {
            this.logger.log("info", "update", "Relationship updated", { relationshipId, updates });
        }
        return updated;
    }
    removeRelationship(relationshipId) {
        this.ensureReady();
        const removed = this.graph.removeEdge(relationshipId);
        if (removed) {
            this.logger.log("info", "remove", "Relationship removed", { relationshipId });
        }
        return removed;
    }
    getRelationships(memoryId) {
        this.ensureReady();
        const outgoing = this.graph.getEdgesFor(memoryId);
        const incoming = this.graph
            .getAllEdges()
            .filter((e) => e.targetId === memoryId && !outgoing.some((o) => o.relationshipId === e.relationshipId));
        return [...outgoing, ...incoming];
    }
    getRecommendations(memoryId, limit = 10) {
        this.ensureReady();
        const start = Date.now();
        const result = this.recommender.recommend(memoryId, limit);
        this.recommendationTimes.push(Date.now() - start);
        this.logger.log("info", "recommendation", "Recommendations generated", {
            memoryId,
            count: result.all.length,
        });
        return result;
    }
    traverse(memoryId, maxDepth = 2) {
        this.ensureReady();
        const start = Date.now();
        const result = this.recommender.traverse(memoryId, maxDepth);
        this.traversalTimes.push(Date.now() - start);
        return result;
    }
    validateIntegrity() {
        this.ensureReady();
        const report = this.integrity.validateAndRepair();
        this.lastIntegrityMs = report.durationMs;
        return report;
    }
    getGraph() {
        this.ensureReady();
        return this.graph.getGraph();
    }
    searchRelationships(query) {
        this.ensureReady();
        let edges = this.graph.getAllEdges();
        if (query.memoryId) {
            edges = edges.filter((e) => e.sourceId === query.memoryId || e.targetId === query.memoryId);
        }
        if (query.relationshipType) {
            edges = edges.filter((e) => e.relationshipType === query.relationshipType);
        }
        if (query.minStrength !== undefined) {
            edges = edges.filter((e) => e.strengthScore >= query.minStrength);
        }
        return edges.sort((a, b) => b.strengthScore - a.strengthScore);
    }
    optimizeGraph() {
        this.ensureReady();
        const start = Date.now();
        const storage = this.foundation.getStorageEngine();
        let nodesRemoved = 0;
        let edgesRemoved = 0;
        for (const nodeId of Object.keys(this.graph.getGraph().nodes)) {
            if (!storage.findIndexEntry(nodeId)) {
                this.graph.removeNode(nodeId);
                nodesRemoved++;
            }
        }
        const integrity = this.validateIntegrity();
        edgesRemoved = integrity.issuesRepaired;
        this.logger.log("info", "optimization", "Graph optimization complete", {
            nodesRemoved,
            edgesRemoved,
            durationMs: Date.now() - start,
        });
        return { nodesRemoved, edgesRemoved };
    }
    buildStatusReport() {
        const graph = this.graph.getGraph();
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        const validEdges = this.graph.getAllEdges().filter((e) => e.validationStatus === ValidationStatus.Valid).length;
        const totalEdges = graph.edgeCount;
        const recommendationQuality = totalEdges > 0 ? `${Math.round((validEdges / totalEdges) * 100)}% validated edges` : "no edges yet";
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            relationshipGraphStatus: `${Object.keys(graph.nodes).length} nodes, ${graph.edgeCount} edges`,
            recommendationQuality,
            integrityStatus: validEdges === totalEdges ? "verified" : "partial validation",
            totalNodes: Object.keys(graph.nodes).length,
            totalEdges: graph.edgeCount,
            performance: {
                averageDiscoveryMs: avg(this.discoveryTimes),
                averageTraversalMs: avg(this.traversalTimes),
                averageRecommendationMs: avg(this.recommendationTimes),
                lastIntegrityCheckMs: this.lastIntegrityMs,
            },
            knownIssues: [],
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    validateRelationshipInput(input) {
        const storage = this.foundation.getStorageEngine();
        if (!storage.findIndexEntry(input.sourceId)) {
            throw new RelationshipMemoryEngineError(`Source memory not found: ${input.sourceId}`, "INVALID_SOURCE");
        }
        if (!storage.findIndexEntry(input.targetId)) {
            throw new RelationshipMemoryEngineError(`Target memory not found: ${input.targetId}`, "INVALID_TARGET");
        }
        if (input.sourceId === input.targetId &&
            input.relationshipType !== RelationshipType.Version) {
            throw new RelationshipMemoryEngineError("Self-referencing relationships are not allowed", "INVALID_SELF_REFERENCE");
        }
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new RelationshipMemoryEngineError("Relationship Memory Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=relationship-memory-engine.js.map