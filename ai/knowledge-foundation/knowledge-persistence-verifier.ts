/**
 * Knowledge Persistence Verifier — confirms imported knowledge exists on disk, not only in memory.
 */

import fs from "node:fs";
import path from "node:path";
import type { AiKnowledgeFoundation } from "./knowledge-foundation.js";
import type {
  KnowledgePersistenceCheck,
  KnowledgePersistenceVerificationResult,
  KnowledgeSeedingStatistics,
} from "./knowledge-seeding-types.js";

export class KnowledgePersistenceVerifier {
  verify(foundation: AiKnowledgeFoundation): KnowledgePersistenceVerificationResult {
    const checks: KnowledgePersistenceCheck[] = [];
    const issues: string[] = [];
    const repairs: string[] = [];
    const knowledgeRoot = foundation.getKnowledgeRoot();
    const importer = foundation.getKnowledgePackImportEngine();
    const extraction = foundation.getKnowledgeExtractionEngine();
    const imported = importer
      .listImports()
      .filter((entry) => entry.status === "imported" || entry.status === "activated");

    const requiredDirs = [
      ["packs", path.join(knowledgeRoot, "packs")],
      ["imports", path.join(knowledgeRoot, "imports")],
      ["validation-packs", path.join(knowledgeRoot, "validation", "packs")],
      ["records", path.join(knowledgeRoot, "records")],
      ["graph", path.join(knowledgeRoot, "graph")],
      ["storage-index", path.join(knowledgeRoot, "storage")],
    ];
    for (const [name, dir] of requiredDirs) {
      const exists = fs.existsSync(dir);
      checks.push({ name: `dir:${name}`, passed: exists, detail: exists ? "present" : "missing", diskPath: dir });
      if (!exists) issues.push(`Missing durable directory: ${dir}`);
    }

    const importsFile = path.join(knowledgeRoot, "imports", "imports.json");
    const importsOk = fs.existsSync(importsFile);
    checks.push({
      name: "import-registry",
      passed: importsOk,
      detail: importsOk ? "imports.json on disk" : "missing imports.json",
      diskPath: importsFile,
    });
    if (!importsOk) issues.push("Import registry not persisted on disk.");

    const graphFile = path.join(knowledgeRoot, "graph", "knowledge-graph.json");
    const graphOk = fs.existsSync(graphFile) || imported.length === 0;
    checks.push({
      name: "knowledge-graph",
      passed: graphOk,
      detail: fs.existsSync(graphFile) ? "graph file on disk" : imported.length === 0 ? "no imports yet" : "graph file missing",
      diskPath: graphFile,
    });
    if (!graphOk) issues.push("Knowledge graph file missing on disk.");

    const indexFile = path.join(knowledgeRoot, "storage", "knowledge-record-index.json");
    const indexOk = fs.existsSync(indexFile) || imported.length === 0;
    checks.push({
      name: "search-index",
      passed: indexOk,
      detail: fs.existsSync(indexFile) ? "record index on disk" : imported.length === 0 ? "no imports yet" : "record index missing",
      diskPath: indexFile,
    });
    if (!indexOk) issues.push("Search/record index missing on disk.");

    for (const entry of imported) {
      const packPath = path.join(knowledgeRoot, "packs", entry.packSlug, "pack.json");
      const packOk = fs.existsSync(packPath);
      checks.push({
        name: `pack:${entry.packSlug}`,
        passed: packOk,
        detail: packOk ? "pack.json durable" : "pack.json missing",
        diskPath: packPath,
      });
      if (!packOk) issues.push(`Imported pack missing on disk: ${entry.packSlug}`);

      const pack = extraction.listPacks().find((item) => item.packSlug === entry.packSlug);
      if (pack) {
        const hasRules =
          pack.structuredKnowledge.decisionRules.length > 0 || pack.items.some((item) => item.decisionRules.length > 0);
        const hasWorkflows =
          pack.structuredKnowledge.workflowSteps.length > 0 || pack.items.some((item) => item.workflow.length > 0);
        const hasExamples =
          pack.structuredKnowledge.examples.length > 0 || pack.items.some((item) => item.examples.length > 0);
        const hasScores = pack.items.every(
          (item) => typeof item.confidenceScore === "number" && typeof item.qualityScore === "number"
        );
        checks.push({ name: `decision-rules:${entry.packSlug}`, passed: hasRules, detail: hasRules ? "present" : "missing" });
        checks.push({
          name: `workflows:${entry.packSlug}`,
          passed: hasWorkflows,
          detail: hasWorkflows ? "present" : "missing",
        });
        checks.push({
          name: `examples:${entry.packSlug}`,
          passed: hasExamples,
          detail: hasExamples ? "present" : "missing",
        });
        checks.push({ name: `scores:${entry.packSlug}`, passed: hasScores, detail: hasScores ? "present" : "missing" });
        if (!hasRules) issues.push(`Missing decision rules for ${entry.packSlug}`);
        if (!hasWorkflows) issues.push(`Missing workflows for ${entry.packSlug}`);
        if (!hasExamples) issues.push(`Missing examples for ${entry.packSlug}`);
        if (!hasScores) issues.push(`Missing confidence/quality scores for ${entry.packSlug}`);

        const versionsDir = path.join(knowledgeRoot, "packs", entry.packSlug, "versions");
        checks.push({
          name: `version-history:${entry.packSlug}`,
          passed: fs.existsSync(versionsDir),
          detail: fs.existsSync(versionsDir) ? "versions directory present" : "versions directory missing",
          diskPath: versionsDir,
        });
      }

      if (entry.knowledgeId) {
        const indexed = foundation
          .getStorageEngine()
          .getIndexEntries()
          .some((item) => item.knowledgeId === entry.knowledgeId);
        checks.push({
          name: `record:${entry.knowledgeId}`,
          passed: indexed,
          detail: indexed ? "indexed durable record" : "missing from durable index",
        });
        if (!indexed) issues.push(`Imported knowledge id missing from durable index: ${entry.knowledgeId}`);
      }
    }

    if (imported.length === 0) {
      issues.push("No imported knowledge packs found to verify for persistence.");
    }

    return {
      verified: issues.length === 0,
      checks,
      issues,
      repairs,
      verifiedAt: new Date().toISOString(),
    };
  }

  collectStatistics(foundation: AiKnowledgeFoundation): KnowledgeSeedingStatistics {
    const domains = foundation.getKnowledgeDomainPlanner().listDomains();
    const packs = foundation.getKnowledgeExtractionEngine().listPacks();
    const imported = foundation
      .getKnowledgePackImportEngine()
      .listImports()
      .filter((entry) => entry.status === "imported" || entry.status === "activated");
    const certified = foundation.getKnowledgePackValidationEngine().listResults().filter((result) => result.certified);
    const understood = foundation.getDocumentUnderstandingEngine().listUnderstood();
    const items = packs.flatMap((pack) => pack.items);

    let totalRelationships = 0;
    try {
      const graphPath = path.join(foundation.getKnowledgeRoot(), "graph", "knowledge-graph.json");
      if (fs.existsSync(graphPath)) {
        const graph = JSON.parse(fs.readFileSync(graphPath, "utf8")) as {
          edges?: Record<string, unknown> | unknown[];
          relationships?: unknown[];
          edgeCount?: number;
        };
        if (typeof graph.edgeCount === "number") {
          totalRelationships = graph.edgeCount;
        } else if (Array.isArray(graph.edges)) {
          totalRelationships = graph.edges.length;
        } else if (graph.edges && typeof graph.edges === "object") {
          totalRelationships = Object.keys(graph.edges).length;
        } else if (Array.isArray(graph.relationships)) {
          totalRelationships = graph.relationships.length;
        }
      }
    } catch {
      totalRelationships = 0;
    }

    const sources = new Set<string>();
    for (const pack of packs) {
      for (const item of pack.items) {
        for (const source of item.sourceMetadata) sources.add(source.name);
      }
    }

    return {
      totalKnowledgeDomains: domains.length,
      totalKnowledgePacks: packs.length,
      totalKnowledgeItems: items.length,
      totalRelationships,
      totalDecisionRules: packs.reduce((sum, pack) => sum + pack.structuredKnowledge.decisionRules.length, 0),
      totalWorkflows: packs.reduce((sum, pack) => sum + pack.structuredKnowledge.workflowSteps.length, 0),
      totalExamples: packs.reduce((sum, pack) => sum + pack.structuredKnowledge.examples.length, 0),
      totalSources: sources.size,
      totalDocuments: understood.length,
      totalMetadataEntries:
        packs.length +
        imported.length +
        certified.length +
        foundation.getStorageEngine().getRecordCount() +
        (fs.existsSync(path.join(foundation.getKnowledgeRoot(), "imports", "imports.json")) ? 1 : 0),
      totalImportedPacks: imported.length,
      totalCertifiedPacks: certified.length,
    };
  }
}
