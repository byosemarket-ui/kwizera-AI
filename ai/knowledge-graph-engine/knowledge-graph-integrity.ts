import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import { KnowledgeGraphLogger } from "./graph-logger.js";
import {
  GraphIntegrityDiagnostic,
  GraphIntegrityReport,
  GraphValidationStatus,
  KnowledgeRelationType,
} from "./types.js";

export class KnowledgeGraphIntegrityValidator {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly graph: KnowledgeGraphStore,
    private readonly logger: KnowledgeGraphLogger
  ) {}

  validateAndRepair(): GraphIntegrityReport {
    const start = Date.now();
    const diagnostics: GraphIntegrityDiagnostic[] = [];
    let repaired = 0;

    const storage = this.foundation.getStorageEngine();
    const graph = this.graph.getGraph();

    for (const nodeId of Object.keys(graph.nodes)) {
      const node = graph.nodes[nodeId];
      if (!node) continue;

      const isKnowledgeNode = Boolean(node.knowledgeType);
      if (isKnowledgeNode && !storage.findIndexEntry(nodeId)) {
        this.graph.removeNode(nodeId);
        repaired++;
        diagnostics.push({
          issue: "orphan-node",
          severity: "error",
          repaired: true,
          detail: `Removed orphan knowledge node: ${nodeId}`,
        });
      }
    }

    const seenNodes = new Set<string>();
    for (const nodeId of Object.keys(this.graph.getGraph().nodes)) {
      if (seenNodes.has(nodeId)) {
        this.graph.removeNode(nodeId);
        repaired++;
        diagnostics.push({
          issue: "duplicate-node",
          severity: "warning",
          repaired: true,
          detail: `Removed duplicate node entry: ${nodeId}`,
        });
      }
      seenNodes.add(nodeId);
    }

    for (const edge of [...this.graph.getAllEdges()]) {
      const source = this.graph.getNode(edge.sourceId);
      const target = this.graph.getNode(edge.targetId);

      if (!source || !target) {
        this.graph.removeEdge(edge.relationshipId);
        repaired++;
        diagnostics.push({
          issue: "broken-relationship",
          severity: "error",
          repaired: true,
          detail: `Removed broken edge ${edge.relationshipId}`,
        });
        continue;
      }

      if (
        edge.sourceId === edge.targetId &&
        edge.relationshipType !== KnowledgeRelationType.PartOf
      ) {
        this.graph.removeEdge(edge.relationshipId);
        repaired++;
        diagnostics.push({
          issue: "circular-reference",
          severity: "warning",
          repaired: true,
          detail: `Removed self-referencing edge ${edge.relationshipId}`,
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

    for (const cycle of this.detectDependencyCycles()) {
      diagnostics.push({
        issue: "circular-dependency",
        severity: "warning",
        repaired: false,
        detail: `Dependency cycle detected: ${cycle.join(" → ")}`,
      });
    }

    for (const edge of this.graph.getAllEdges()) {
      if (!edge.evidence || edge.evidence.trim() === "") {
        this.graph.updateEdge(edge.relationshipId, {
          validationStatus: GraphValidationStatus.Invalid,
        });
        diagnostics.push({
          issue: "missing-evidence",
          severity: "error",
          repaired: false,
          detail: `Edge ${edge.relationshipId} lacks evidence`,
        });
      } else if (edge.validationStatus !== GraphValidationStatus.Valid) {
        this.graph.updateEdge(edge.relationshipId, { validationStatus: GraphValidationStatus.Valid });
      }
    }

    const valid = diagnostics.filter((d) => !d.repaired && d.severity === "error").length === 0;

    this.logger.log("info", "integrity", "Graph integrity check complete", {
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

  private detectDependencyCycles(): string[][] {
    const cycles: string[][] = [];
    const depEdges = this.graph.getAllEdges().filter(
      (e) =>
        e.relationshipType === KnowledgeRelationType.DependsOn ||
        e.relationshipType === KnowledgeRelationType.Requires
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
