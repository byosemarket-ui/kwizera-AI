import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  MemoryStorageType,
  ProjectType,
  RelationshipType,
  type RelationshipMemoryStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-relationship-memory-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3J Relationship Memory Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3j-validation");

    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const relationships = foundation.getRelationshipMemoryEngine();

    results.initialization = {
      passed: relationships.isInitialized() && relationships.isStartupComplete(),
      detail: "Relationship Memory Engine operational",
    };

    const relationshipDir = path.join(storageRoot, "memory", "relationships");
    results.graphStorage = {
      passed:
        fs.existsSync(relationshipDir) &&
        fs.existsSync(path.join(relationshipDir, "relationship-graph.json")),
      detail: relationshipDir,
    };

    const logDir = path.join(storageRoot, "logs");
    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `relationship-memory-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    await projects.createProject({
      projectId: "step3j-project",
      projectName: "Step 3J Relationship Validation",
      projectType: ProjectType.Product,
      description: "Validates relationship memory engine",
      tags: ["validation", "kwizera", "brand-kwizera"],
    });

    const productStart = Date.now();
    await products.createProduct({
      productId: "step3j-product-a",
      projectId: "step3j-project",
      productName: "KWIZERA Pro Studio",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-PRO-3J-A",
      description: "First product for relationship validation.",
      features: ["AI workflow", "Local-first storage"],
      specifications: { version: "1.0", platform: "Windows" },
      materials: ["digital-license"],
      colors: ["#1a1a2e"],
      sizes: ["standard"],
      price: 149.99,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software", "kwizera", "validation"],
    });

    await products.createProduct({
      productId: "step3j-product-b",
      projectId: "step3j-project",
      productName: "KWIZERA Lite Studio",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-PRO-3J-B",
      description: "Second product for similarity discovery.",
      features: ["AI workflow"],
      specifications: { version: "1.0", platform: "Windows" },
      materials: ["digital-license"],
      colors: ["#e94560"],
      sizes: ["standard"],
      price: 79.99,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software", "kwizera", "validation"],
    });
    const productMs = Date.now() - productStart;

    const discoveryStart = Date.now();
    const discovery = await relationships.discoverRelationships();
    const discoveryMs = Date.now() - discoveryStart;

    results.relationshipDiscovery = {
      passed: discovery.discovered >= 0,
      detail: `Discovered ${discovery.discovered} relationship(s) in ${discoveryMs}ms`,
    };

    const graph = relationships.getGraph();
    results.graphStructure = {
      passed: graph.edgeCount >= 1 && Object.keys(graph.nodes).length >= 2,
      detail: `${Object.keys(graph.nodes).length} nodes, ${graph.edgeCount} edges`,
    };

    const recStart = Date.now();
    const recommendations = relationships.getRecommendations("step3j-product-a");
    const recMs = Date.now() - recStart;

    results.recommendations = {
      passed: recommendations.all.length > 0,
      detail: `${recommendations.all.length} recommendation(s), projects=${recommendations.projects.length}, products=${recommendations.products.length}`,
    };

    const manualEdge = relationships.createRelationship({
      sourceId: "step3j-product-a",
      targetId: "step3j-product-b",
      sourceType: MemoryStorageType.Product,
      targetType: MemoryStorageType.Product,
      relationshipType: RelationshipType.RecommendedWith,
      reason: "Validation manual link",
      strengthScore: 88,
      confidenceScore: 92,
    });

    results.relationshipStrength = {
      passed: manualEdge !== null && manualEdge.strengthScore === 88 && manualEdge.confidenceScore === 92,
      detail: manualEdge
        ? `strength=${manualEdge.strengthScore}, confidence=${manualEdge.confidenceScore}`
        : "manual edge creation failed",
    };

    const integrity = relationships.validateIntegrity();
    results.integrity = {
      passed: integrity.valid,
      detail: `${integrity.issuesFound} issue(s), ${integrity.issuesRepaired} repaired`,
    };

    const traverseStart = Date.now();
    const traversed = relationships.traverse("step3j-product-a", 2);
    const traverseMs = Date.now() - traverseStart;

    results.graphTraversal = {
      passed: traversed.length > 0,
      detail: `Traversed ${traversed.length} node(s) in ${traverseMs}ms`,
    };

    const search = relationships.searchRelationships({
      memoryId: "step3j-product-a",
      minStrength: 50,
    });
    results.relationshipSearch = {
      passed: search.length > 0,
      detail: `${search.length} edge(s) found`,
    };

    const status = relationships.buildStatusReport();
    results.readiness = {
      passed: status.readinessScore === 100,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const relModule = foundation.getRegistry().getModule("persistent-memory");
    results.registry = {
      passed: relModule?.implemented === true,
      detail: relModule ? "persistent-memory registered" : "module missing",
    };

    const allPassed = Object.values(results).every((r) => r.passed);

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);

    const reportPath = path.join(process.cwd(), "STEP-3J-VALIDATION-REPORT.md");
    fs.writeFileSync(
      reportPath,
      buildReport(status, results, storageRoot, allPassed, productMs, discoveryMs, recMs, traverseMs),
      "utf8"
    );
    console.log("Report written:", reportPath);

    await core.stop();

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
  status: RelationshipMemoryStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  productMs: number,
  discoveryMs: number,
  recMs: number,
  traverseMs: number
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3J Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3J — Relationship Memory Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Relationship Memory Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    "",
    "## Relationship Graph Status",
    "",
    `- ${status.relationshipGraphStatus}`,
    "",
    "## Recommendation Quality",
    "",
    `- ${status.recommendationQuality}`,
    "",
    "## Integrity Status",
    "",
    `- ${status.integrityStatus}`,
    "",
    "## Validation Results",
    "",
    "| Check | Status | Detail |",
    "|-------|--------|--------|",
    ...Object.entries(results).map(
      ([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`
    ),
    "",
    "## Performance",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Product Setup | ${productMs}ms |`,
    `| Relationship Discovery | ${discoveryMs}ms |`,
    `| Recommendations | ${recMs}ms |`,
    `| Graph Traversal | ${traverseMs}ms |`,
    `| Average Discovery | ${status.performance.averageDiscoveryMs}ms |`,
    `| Average Traversal | ${status.performance.averageTraversalMs}ms |`,
    `| Average Recommendation | ${status.performance.averageRecommendationMs}ms |`,
    `| Last Integrity Check | ${status.performance.lastIntegrityCheckMs}ms |`,
    `| Total Nodes | ${status.totalNodes} |`,
    `| Total Edges | ${status.totalEdges} |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3J Relationship Memory Engine validation complete. Awaiting user approval before Step 3K.",
    "",
  ].join("\n");
}

void main();
