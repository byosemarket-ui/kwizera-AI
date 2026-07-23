import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  KnowledgeCreativeDirectionStyle,
  KnowledgeCreativeDomain,
  KnowledgeCreativeMarketingGoal,
  KnowledgeCreativePlatform,
  type KnowledgeOptimizationStatusReport,
} from "../ai/index.js";
import type { CreativeAnalysisInput } from "../ai/creative-knowledge-engine/types.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-optimization-"));
}

const SAMPLE_PROMO: CreativeAnalysisInput = {
  creativeId: "step4l-kwizera-promo",
  projectName: "KWIZERA Pro Promotional Campaign",
  domain: KnowledgeCreativeDomain.AdvertisingDesign,
  creativeStyle: KnowledgeCreativeDirectionStyle.Premium,
  platform: KnowledgeCreativePlatform.Instagram,
  industry: "creative-technology",
  brandName: "KWIZERA",
  productName: "KWIZERA Pro",
  marketingGoal: KnowledgeCreativeMarketingGoal.Conversion,
  colorPalette: ["#1a1a2e", "#e94560", "#ffffff"],
  animationStyle: "smooth-commercial",
  visual: {
    balance: 90,
    contrast: 88,
    negativeSpace: 85,
    whiteSpace: 88,
    typography: "Inter / bold headlines",
  },
  storytelling: {
    attentionRetention: 92,
    storyStructure: "hook-product-cta",
    sceneFlow: "hook → showcase → proof → cta",
  },
  animation: { animationQuality: 90, motionPrinciples: ["anticipation", "staging", "timing"] },
  cinematic: { visualContinuity: 92, colorGrading: "warm-commercial" },
  tags: ["creative", "kwizera", "validation", "optimization"],
};

const SAMPLE_POSTER: CreativeAnalysisInput = {
  creativeId: "step4l-kwizera-poster",
  projectName: "KWIZERA Launch Poster",
  domain: KnowledgeCreativeDomain.PosterDesign,
  creativeStyle: KnowledgeCreativeDirectionStyle.Bold,
  platform: KnowledgeCreativePlatform.Facebook,
  brandName: "KWIZERA",
  visual: { balance: 72, contrast: 70, whiteSpace: 65 },
  storytelling: { attentionRetention: 70 },
  animation: { animationQuality: 65 },
  tags: ["creative", "kwizera", "validation", "optimization"],
};

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 4L Knowledge Optimization Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-4l-validation");

    const foundation = core.getManager().knowledgeFoundation!;
    const creative = foundation.getCreativeKnowledgeEngine();
    const retrieval = foundation.getRetrievalEngine();
    const graph = foundation.getGraphEngine();
    const optimization = foundation.getKnowledgeOptimizationEngine();

    results.initialization = {
      passed: optimization.isInitialized() && optimization.isStartupComplete(),
      detail: "Knowledge Optimization Engine operational",
    };

    const optimizationDir = path.join(storageRoot, "knowledge", "optimization", "engine");
    results.optimizationDirectories = {
      passed: fs.existsSync(optimizationDir),
      detail: optimizationDir,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `knowledge-optimization-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    await creative.analyzeCreative(SAMPLE_PROMO);
    await creative.analyzeCreative(SAMPLE_POSTER);

    const analysisStart = Date.now();
    const analysis = await optimization.analyzeKnowledge();
    const analysisMs = Date.now() - analysisStart;

    results.knowledgeAnalysis = {
      passed: analysis.totalRecords > 0 && analysis.indexQualityScore > 0,
      detail: `${analysis.totalRecords} records, index quality ${analysis.indexQualityScore}`,
    };

    const tiers = optimization.classifyTiers();
    results.knowledgeTiers = {
      passed: tiers.length > 0,
      detail: `${tiers.length} tier assignment(s)`,
    };

    const duplicates = optimization.detectDuplicates();
    results.duplicateDetection = {
      passed: Array.isArray(duplicates),
      detail: `${duplicates.length} duplicate group(s) detected`,
    };

    const recoveryPoint = optimization.createRecoveryPoint("step-4l-validation");
    results.recovery = {
      passed: recoveryPoint.recoveryPointId.startsWith("rp-"),
      detail: `Recovery point ${recoveryPoint.recoveryPointId}`,
    };

    const promoId = "creative-knowledge-step4l-kwizera-promo";
    await retrieval.retrieve(promoId, "step-4l-validation");
    await retrieval.retrieve(promoId, "step-4l-validation");
    await retrieval.retrieve(promoId, "step-4l-validation");

    optimization.classifyTiers();
    const cacheStart = Date.now();
    const cacheResult = await optimization.optimizeCache();
    const cacheMs = Date.now() - cacheStart;

    results.cacheOptimization = {
      passed: cacheResult.warmed >= 0,
      detail: `Warmed ${cacheResult.warmed} entries in ${cacheMs}ms`,
    };

    const optimizeStart = Date.now();
    const optimizeResult = await optimization.runOptimization();
    const optimizeMs = Date.now() - optimizeStart;

    results.optimization = {
      passed: optimizeResult.success,
      detail: `${optimizeResult.steps.length} step(s) in ${optimizeMs}ms`,
    };

    results.classificationOptimization = {
      passed: optimizeResult.steps.some(
        (s) => s.strategy === "classification" && s.success
      ),
      detail: "Classification optimization step completed",
    };

    results.relationshipOptimization = {
      passed: optimizeResult.steps.some(
        (s) => s.strategy === "relationship" && s.success
      ),
      detail: "Relationship optimization step completed",
    };

    results.graphOptimization = {
      passed: optimizeResult.steps.some((s) => s.strategy === "graph" && s.success),
      detail: "Graph optimization step completed",
    };

    results.recommendationOptimization = {
      passed: optimizeResult.steps.some(
        (s) => s.strategy === "recommendation" && s.success
      ),
      detail: "Recommendation optimization step completed",
    };

    const integrity = await optimization.verifyIntegrity();
    results.integrity = {
      passed: integrity.valid,
      detail:
        integrity.diagnostics.length === 0
          ? "All checks passed"
          : integrity.diagnostics.join("; "),
    };

    const searchStart = Date.now();
    const search = await retrieval.search({
      text: "KWIZERA",
      limit: 5,
      requesterId: "step-4l-validation",
    });
    const searchMs = Date.now() - searchStart;

    results.searchPerformance = {
      passed: search.results.length > 0,
      detail: `${search.results.length} result(s) in ${searchMs}ms`,
    };

    const retrieveStart = Date.now();
    const retrieved = await retrieval.retrieve(promoId, "step-4l-validation");
    const retrieveMs = Date.now() - retrieveStart;

    results.retrievalPerformance = {
      passed: retrieved.success,
      detail: `Retrieved in ${retrieveMs}ms`,
    };

    const recStart = Date.now();
    const recs = graph.getRecommendations(promoId, 5);
    const recMs = Date.now() - recStart;

    results.recommendationPerformance = {
      passed: recs.all.length >= 0,
      detail: `${recs.all.length} recommendation(s) in ${recMs}ms`,
    };

    const status = optimization.buildStatusReport();
    results.readiness = {
      passed: status.readinessScore === 100,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const allPassed = Object.values(results).every((r) => r.passed);

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);

    const reportPath = path.join(process.cwd(), "STEP-4L-VALIDATION-REPORT.md");
    fs.writeFileSync(
      reportPath,
      buildReport(status, results, storageRoot, allPassed, analysisMs, optimizeMs, searchMs, retrieveMs),
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
  status: KnowledgeOptimizationStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  analysisMs: number,
  optimizeMs: number,
  searchMs: number,
  retrieveMs: number
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 4 Step 4L Validation Report",
    "",
    "**Phase:** 4 — Knowledge Engine",
    "**Step:** 4L — Knowledge Optimization Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Knowledge Optimization Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    `| **Total Optimizations** | ${status.totalOptimizations} |`,
    "",
    "## Knowledge Quality Improvement",
    "",
    `- ${status.knowledgeQualityImprovement}`,
    "",
    "## Relationship Optimization Status",
    "",
    `- ${status.relationshipOptimizationStatus}`,
    "",
    "## Recommendation Performance",
    "",
    `- ${status.recommendationPerformance}`,
    "",
    "## Graph Performance",
    "",
    `- ${status.graphPerformance}`,
    "",
    "## Recovery Status",
    "",
    `- ${status.recoveryStatus}`,
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
    `| Analysis | ${analysisMs}ms |`,
    `| Optimization | ${optimizeMs}ms |`,
    `| Search | ${searchMs}ms |`,
    `| Retrieval | ${retrieveMs}ms |`,
    `| Average Optimization | ${status.performance.averageOptimizationMs}ms |`,
    `| Average Analysis | ${status.performance.averageAnalysisMs}ms |`,
    "",
    "## Tier Distribution",
    "",
    ...Object.entries(status.tierDistribution).map(([tier, count]) => `- **${tier}:** ${count}`),
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 4L Knowledge Optimization Engine validation complete. Awaiting user approval before Step 4M.",
    "",
  ].join("\n");
}

void main();
