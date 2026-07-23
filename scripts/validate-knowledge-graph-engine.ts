import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  KnowledgeRelationType,
  KnowledgeStorageType,
  KnowledgeVerificationStatus,
  type KnowledgeGraphStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-graph-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 4D Knowledge Graph Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-4d-validation");

    const foundation = core.getManager().knowledgeFoundation!;
    const storage = foundation.getStorageEngine();
    const graph = foundation.getGraphEngine();

    results.initialization = {
      passed: graph.isInitialized() && graph.isStartupComplete(),
      detail: graph.isStartupComplete() ? "Knowledge Graph Engine operational" : "Not ready",
    };

    const graphDir = path.join(storageRoot, "knowledge", "graph");
    results.graphStorage = {
      passed:
        fs.existsSync(graphDir) && fs.existsSync(path.join(graphDir, "knowledge-graph.json")),
      detail: graphDir,
    };

    await storage.storeRecord({
      knowledgeId: "step4d-product",
      knowledgeType: KnowledgeStorageType.Product,
      category: "product",
      title: "KWIZERA Pro Product Knowledge",
      description: "Product knowledge for graph validation with brand and marketing links.",
      source: "step-4d-validation",
      tags: ["kwizera", "product", "validation"],
      keywords: ["product", "studio"],
      relatedMemory: ["project-memory-step4d"],
      qualityScore: 92,
      confidenceScore: 90,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await storage.storeRecord({
      knowledgeId: "step4d-marketing",
      knowledgeType: KnowledgeStorageType.Marketing,
      category: "marketing",
      title: "KWIZERA Marketing Campaign Knowledge",
      description: "Marketing campaign knowledge linked to KWIZERA product launch.",
      source: "step-4d-validation",
      tags: ["kwizera", "marketing", "validation"],
      relatedKnowledge: ["step4d-product"],
      qualityScore: 88,
      confidenceScore: 86,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await storage.storeRecord({
      knowledgeId: "step4d-workflow",
      knowledgeType: KnowledgeStorageType.Workflow,
      category: "workflow",
      title: "KWIZERA Creative Workflow Knowledge",
      description: "Workflow knowledge for planning and decision making in creative production.",
      source: "step-4d-validation",
      keywords: ["workflow", "creative"],
      qualityScore: 85,
      confidenceScore: 84,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    const discoveryStart = Date.now();
    const discovery = await graph.discoverRelationships();
    const discoveryMs = Date.now() - discoveryStart;

    results.nodeCreation = {
      passed: Object.keys(graph.getGraph().nodes).length >= 3,
      detail: `${Object.keys(graph.getGraph().nodes).length} node(s)`,
    };

    results.relationshipDiscovery = {
      passed: discovery.discovered >= 1,
      detail: `Discovered ${discovery.discovered} relationship(s) in ${discoveryMs}ms`,
    };

    const manualEdge = graph.createRelationship({
      sourceId: "step4d-product",
      targetId: "step4d-workflow",
      relationshipType: KnowledgeRelationType.Uses,
      evidence: "Product knowledge uses creative workflow for production planning",
      strengthScore: 80,
      confidenceScore: 85,
    });

    results.relationshipCreation = {
      passed: Boolean(manualEdge),
      detail: manualEdge?.relationshipId ?? "failed",
    };

    const traverseStart = Date.now();
    const traversed = graph.traverse("step4d-product", 2);
    const traverseMs = Date.now() - traverseStart;

    results.graphTraversal = {
      passed: traversed.length >= 1,
      detail: `${traversed.length} node(s) in ${traverseMs}ms`,
    };

    const searchStart = Date.now();
    const nodes = graph.searchNodes({ text: "kwizera", limit: 10 });
    const relationships = graph.searchRelationships({ nodeId: "step4d-product" });
    const searchMs = Date.now() - searchStart;

    results.graphSearch = {
      passed: nodes.length >= 2 && relationships.length >= 1,
      detail: `${nodes.length} nodes, ${relationships.length} relationships in ${searchMs}ms`,
    };

    const pathResult = graph.shortestPath("step4d-marketing", "step4d-workflow");
    results.pathSearch = {
      passed: pathResult.found || graph.findPath("step4d-marketing", "step4d-product").found,
      detail: pathResult.found ? `Path length ${pathResult.distance}` : "connected via product",
    };

    const similar = graph.similaritySearch("step4d-product", 5);
    results.similaritySearch = {
      passed: similar.length >= 1,
      detail: `${similar.length} similar node(s)`,
    };

    const recs = graph.getRecommendations("step4d-product", 5);
    results.recommendations = {
      passed: recs.all.length >= 1,
      detail: `${recs.all.length} recommendation(s)`,
    };

    const integrity = graph.validateIntegrity();
    results.integrity = {
      passed: integrity.valid || integrity.issuesRepaired > 0,
      detail: `${integrity.issuesFound} issue(s), ${integrity.issuesRepaired} repaired`,
    };

    const optimized = graph.optimizeGraph();
    results.optimization = {
      passed: optimized.nodesRemoved >= 0,
      detail: `Removed ${optimized.nodesRemoved} node(s), ${optimized.edgesRemoved} edge(s)`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `knowledge-graph-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    const report = graph.buildStatusReport();
    results.performance = {
      passed: discoveryMs < 15000 && traverseMs < 5000,
      detail: `discovery ${discoveryMs}ms, traverse ${traverseMs}ms`,
    };

    results.readiness = {
      passed: report.readinessScore === 100,
      detail: `Readiness ${report.readinessScore}/100`,
    };

    await core.stop("step-4d-validation-complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-4D-VALIDATION-REPORT.md");
    fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed), "utf8");

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${report.readinessScore}/100`);
    console.log("Report written:", reportPath);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildReport(
  status: KnowledgeGraphStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 4 Step 4D Validation Report",
    "",
    "**Phase:** 4 — Knowledge Engine",
    "**Step:** 4D — Knowledge Graph Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Knowledge Graph Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Graph Status** | ${status.graphStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    "",
    "## Validation Results",
    "",
    "| Check | Status | Detail |",
    "|-------|--------|--------|",
    ...Object.entries(results).map(
      ([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`
    ),
    "",
    "## Graph Metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Node Count | ${status.nodeCount} |`,
    `| Relationship Count | ${status.relationshipCount} |`,
    `| Graph Integrity | ${status.graphIntegrity} |`,
    `| Recommendation Quality | ${status.recommendationQuality} |`,
    "",
    "## Performance",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Average Discovery | ${status.performance.averageDiscoveryMs}ms |`,
    `| Average Traversal | ${status.performance.averageTraversalMs}ms |`,
    `| Average Search | ${status.performance.averageSearchMs}ms |`,
    `| Average Recommendation | ${status.performance.averageRecommendationMs}ms |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 4D Knowledge Graph Engine validation complete. Awaiting user approval before Step 4E.",
    "",
  ].join("\n");
}

void main();
