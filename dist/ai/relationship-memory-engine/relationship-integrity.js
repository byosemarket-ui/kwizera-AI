import { RelationshipType, ValidationStatus } from "./types.js";
export class RelationshipIntegrityValidator {
    foundation;
    graph;
    logger;
    constructor(foundation, graph, logger) {
        this.foundation = foundation;
        this.graph = graph;
        this.logger = logger;
    }
    validateAndRepair() {
        const start = Date.now();
        const diagnostics = [];
        let repaired = 0;
        const storage = this.foundation.getStorageEngine();
        const graph = this.graph.getGraph();
        const edgeIds = Object.keys(graph.edges);
        for (const edgeId of edgeIds) {
            const edge = graph.edges[edgeId];
            if (!edge)
                continue;
            const sourceExists = Boolean(storage.findIndexEntry(edge.sourceId));
            const targetExists = Boolean(storage.findIndexEntry(edge.targetId));
            if (!sourceExists || !targetExists) {
                this.graph.removeEdge(edgeId);
                repaired++;
                diagnostics.push({
                    issue: "broken-reference",
                    severity: "error",
                    repaired: true,
                    detail: `Removed edge ${edgeId}: missing ${!sourceExists ? "source" : "target"}`,
                });
                continue;
            }
            if (edge.sourceId === edge.targetId && edge.relationshipType !== RelationshipType.Version) {
                this.graph.removeEdge(edgeId);
                repaired++;
                diagnostics.push({
                    issue: "self-reference",
                    severity: "warning",
                    repaired: true,
                    detail: `Removed self-referencing edge ${edgeId}`,
                });
            }
        }
        const seen = new Set();
        for (const edge of this.graph.getAllEdges()) {
            const key = `${edge.sourceId}|${edge.targetId}|${edge.relationshipType}`;
            if (seen.has(key)) {
                this.graph.removeEdge(edge.relationshipId);
                repaired++;
                diagnostics.push({
                    issue: "duplicate-relationship",
                    severity: "warning",
                    repaired: true,
                    detail: `Removed duplicate edge ${edge.relationshipId}`,
                });
            }
            else {
                seen.add(key);
            }
        }
        const circular = this.detectCircularDependencies();
        for (const cycle of circular) {
            diagnostics.push({
                issue: "circular-dependency",
                severity: "warning",
                repaired: false,
                detail: `Circular dependency detected: ${cycle.join(" → ")}`,
            });
        }
        for (const edge of this.graph.getAllEdges()) {
            if (edge.validationStatus !== ValidationStatus.Valid) {
                this.graph.updateEdge(edge.relationshipId, { validationStatus: ValidationStatus.Valid });
            }
        }
        const valid = diagnostics.filter((d) => !d.repaired && d.severity === "error").length === 0;
        this.logger.log("info", "integrity", "Integrity check complete", {
            issues: diagnostics.length,
            repaired,
            valid,
        });
        return {
            valid,
            issuesFound: diagnostics.length,
            issuesRepaired: repaired,
            diagnostics,
            durationMs: Date.now() - start,
        };
    }
    detectCircularDependencies() {
        const cycles = [];
        const depEdges = this.graph.getAllEdges().filter((e) => e.relationshipType === RelationshipType.Dependency);
        const adjacency = new Map();
        for (const edge of depEdges) {
            const list = adjacency.get(edge.sourceId) ?? [];
            list.push(edge.targetId);
            adjacency.set(edge.sourceId, list);
        }
        const visited = new Set();
        const stack = new Set();
        const dfs = (node, path) => {
            if (stack.has(node)) {
                cycles.push([...path, node]);
                return;
            }
            if (visited.has(node))
                return;
            visited.add(node);
            stack.add(node);
            for (const next of adjacency.get(node) ?? []) {
                dfs(next, [...path, node]);
            }
            stack.delete(node);
        };
        for (const node of adjacency.keys()) {
            dfs(node, []);
        }
        return cycles;
    }
}
//# sourceMappingURL=relationship-integrity.js.map