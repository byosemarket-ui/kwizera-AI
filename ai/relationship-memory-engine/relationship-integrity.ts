import { RelationshipGraphStore } from "./relationship-graph-store.js";
import { RelationshipMemoryLogger } from "./relationship-logger.js";
import { IntegrityDiagnostic, IntegrityReport, RelationshipType, ValidationStatus } from "./types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";

export class RelationshipIntegrityValidator {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly graph: RelationshipGraphStore,
    private readonly logger: RelationshipMemoryLogger
  ) {}

  validateAndRepair(): IntegrityReport {
    const start = Date.now();
    const diagnostics: IntegrityDiagnostic[] = [];
    let repaired = 0;

    const storage = this.foundation.getStorageEngine();
    const graph = this.graph.getGraph();
    const edgeIds = Object.keys(graph.edges);

    for (const edgeId of edgeIds) {
      const edge = graph.edges[edgeId];
      if (!edge) continue;

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

    const seen = new Set<string>();
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
      } else {
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

  private detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const depEdges = this.graph.getAllEdges().filter(
      (e) => e.relationshipType === RelationshipType.Dependency
    );

    const adjacency = new Map<string, string[]>();
    for (const edge of depEdges) {
      const list = adjacency.get(edge.sourceId) ?? [];
      list.push(edge.targetId);
      adjacency.set(edge.sourceId, list);
    }

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (stack.has(node)) {
        cycles.push([...path, node]);
        return;
      }
      if (visited.has(node)) return;
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
