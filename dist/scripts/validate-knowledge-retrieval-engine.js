import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, KnowledgeSearchMode, KnowledgeStorageType, KnowledgeVerificationStatus, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-retrieval-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4C Knowledge Retrieval Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-4c-validation");
        const foundation = core.getManager().knowledgeFoundation;
        const storage = foundation.getStorageEngine();
        const engine = foundation.getRetrievalEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete() ? "Retrieval Engine operational" : "Not ready",
        };
        const product = await storage.storeRecord({
            knowledgeId: "step4c-product-knowledge",
            knowledgeType: KnowledgeStorageType.Product,
            category: "product",
            title: "KWIZERA Product Intelligence",
            description: "Product knowledge for KWIZERA AI STUDIO creative platform validation.",
            summary: "Core product knowledge",
            source: "step-4c-validation",
            tags: ["kwizera", "product", "validation"],
            keywords: ["product", "intelligence", "studio"],
            relatedMemory: ["project-memory-step4c"],
            qualityScore: 92,
            confidenceScore: 90,
            sourceReliability: 88,
            verificationStatus: KnowledgeVerificationStatus.Verified,
        });
        const marketing = await storage.storeRecord({
            knowledgeId: "step4c-marketing-knowledge",
            knowledgeType: KnowledgeStorageType.Marketing,
            category: "marketing",
            title: "KWIZERA Marketing Campaign Knowledge",
            description: "Marketing knowledge linked to KWIZERA product launch and creative professionals.",
            source: "step-4c-validation",
            tags: ["marketing", "campaign", "kwizera"],
            keywords: ["marketing", "launch"],
            relatedKnowledge: ["step4c-product-knowledge"],
            qualityScore: 88,
            confidenceScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Verified,
        });
        const workflow = await storage.storeRecord({
            knowledgeId: "step4c-workflow-knowledge",
            knowledgeType: KnowledgeStorageType.Workflow,
            category: "workflow",
            title: "KWIZERA Creative Workflow Knowledge",
            description: "Workflow knowledge for AI planning and decision making in creative production.",
            source: "step-4c-validation",
            keywords: ["workflow", "creative", "planning"],
            qualityScore: 86,
            confidenceScore: 84,
            verificationStatus: KnowledgeVerificationStatus.Verified,
        });
        results.sampleKnowledge = {
            passed: product.success && marketing.success && workflow.success,
            detail: `Stored ${[product, marketing, workflow].filter((r) => r.success).length}/3 records`,
        };
        const keywordStart = Date.now();
        const keywordSearch = await engine.search({
            mode: KnowledgeSearchMode.Keyword,
            keywords: ["product", "intelligence"],
            limit: 10,
        });
        const keywordMs = Date.now() - keywordStart;
        results.keywordRetrieval = {
            passed: keywordSearch.success && keywordSearch.results.some((r) => r.knowledgeId === "step4c-product-knowledge"),
            detail: `${keywordSearch.results.length} result(s) in ${keywordMs}ms`,
        };
        const categoryStart = Date.now();
        const categorySearch = await engine.search({
            mode: KnowledgeSearchMode.Category,
            category: "marketing",
            limit: 10,
        });
        const categoryMs = Date.now() - categoryStart;
        results.categoryRetrieval = {
            passed: categorySearch.success && categorySearch.results.some((r) => r.category === "marketing"),
            detail: `${categorySearch.results.length} result(s) in ${categoryMs}ms`,
        };
        const semanticStart = Date.now();
        const semanticSearch = await engine.search({
            mode: KnowledgeSearchMode.Semantic,
            text: "creative professionals marketing launch",
            limit: 10,
        });
        const semanticMs = Date.now() - semanticStart;
        results.semanticRetrieval = {
            passed: semanticSearch.success && semanticSearch.results.length >= 1,
            detail: `${semanticSearch.results.length} result(s) in ${semanticMs}ms`,
        };
        const relationshipStart = Date.now();
        const relationshipSearch = await engine.search({
            mode: KnowledgeSearchMode.Relationship,
            relatedTo: "step4c-product-knowledge",
            limit: 10,
        });
        const relationshipMs = Date.now() - relationshipStart;
        results.relationshipRetrieval = {
            passed: relationshipSearch.success &&
                (relationshipSearch.results.length >= 1 || relationshipSearch.relatedKnowledge.length >= 1),
            detail: `${relationshipSearch.results.length} result(s), ${relationshipSearch.relatedKnowledge.length} related in ${relationshipMs}ms`,
        };
        const contextStart = Date.now();
        const contextSearch = await engine.search({
            mode: KnowledgeSearchMode.Context,
            context: {
                objective: "AI planning and decision making",
                domain: "creative",
                taskType: "workflow",
            },
            limit: 10,
        });
        const contextMs = Date.now() - contextStart;
        results.contextRetrieval = {
            passed: contextSearch.success && contextSearch.results.length >= 1,
            detail: `${contextSearch.results.length} result(s) in ${contextMs}ms`,
        };
        const hybridSearch = await engine.search({
            mode: KnowledgeSearchMode.Hybrid,
            text: "kwizera",
            limit: 10,
        });
        results.ranking = {
            passed: hybridSearch.results.length >= 2 &&
                hybridSearch.results[0].ranking.compositeScore >= hybridSearch.results[1].ranking.compositeScore &&
                hybridSearch.results[0].ranking.qualityScore >= hybridSearch.results[1].ranking.qualityScore,
            detail: `Top score ${hybridSearch.results[0]?.ranking.compositeScore ?? 0}, quality ${hybridSearch.results[0]?.ranking.qualityScore ?? 0}`,
        };
        const retrieveStart = Date.now();
        const retrieved = await engine.retrieve("step4c-product-knowledge");
        const retrieveMs = Date.now() - retrieveStart;
        results.knowledgeRetrieval = {
            passed: retrieved.success && retrieved.record?.knowledgeId === "step4c-product-knowledge",
            detail: `Retrieved in ${retrieveMs}ms`,
        };
        results.relatedRecommendations = {
            passed: retrieved.relatedKnowledge.length >= 1 || retrieved.recommendations.length >= 1,
            detail: `${retrieved.relatedKnowledge.length} related, ${retrieved.recommendations.length} recommended`,
        };
        results.relatedGroups = {
            passed: retrieved.relatedGroups.relatedKnowledge.length >= 1 ||
                retrieved.relatedGroups.relatedProducts.length >= 1,
            detail: `Groups: knowledge=${retrieved.relatedGroups.relatedKnowledge.length}, products=${retrieved.relatedGroups.relatedProducts.length}`,
        };
        const cached = await engine.retrieve("step4c-product-knowledge");
        results.caching = {
            passed: cached.fromCache === true,
            detail: `Cache hit rate ${engine.buildStatusReport().cacheStatus.hitRate}%`,
        };
        results.validation = {
            passed: retrieved.diagnostics.length === 0,
            detail: "Pre-retrieval validation passed",
        };
        const invalid = await engine.retrieve("nonexistent-knowledge-id");
        results.validationFailure = {
            passed: !invalid.success && invalid.recoverySuggestion !== undefined,
            detail: invalid.recoverySuggestion ?? "no suggestion",
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `knowledge-retrieval-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const report = engine.buildStatusReport();
        const maxMs = Math.max(keywordMs, categoryMs, semanticMs, relationshipMs, contextMs, retrieveMs);
        results.performance = {
            passed: maxMs < 10000,
            detail: `max scenario ${maxMs}ms, avg search ${report.searchPerformance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: report.readinessScore === 100,
            detail: `Readiness ${report.readinessScore}/100`,
        };
        await core.stop("step-4c-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4C-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed, {
            keywordMs,
            categoryMs,
            semanticMs,
            relationshipMs,
            contextMs,
            retrieveMs,
        }), "utf8");
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
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildReport(status, results, storageRoot, allPassed, timings) {
    return [
        "# KWIZERA AI STUDIO — Phase 4 Step 4C Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4C — Knowledge Retrieval Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Knowledge Retrieval Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Validation Status** | ${status.validationStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Search Performance",
        "",
        "| Scenario | Time |",
        "|----------|------|",
        `| Keyword Search | ${timings.keywordMs}ms |`,
        `| Category Search | ${timings.categoryMs}ms |`,
        `| Semantic Search | ${timings.semanticMs}ms |`,
        `| Relationship Search | ${timings.relationshipMs}ms |`,
        `| Context Search | ${timings.contextMs}ms |`,
        `| Direct Retrieval | ${timings.retrieveMs}ms |`,
        `| Average Search | ${status.searchPerformance.averageSearchMs}ms |`,
        `| Average Retrieval | ${status.searchPerformance.averageRetrievalMs}ms |`,
        "",
        "## Ranking Quality",
        "",
        `- ${status.rankingQuality}`,
        `- Total searches: ${status.totalSearches}`,
        `- Total retrievals: ${status.totalRetrievals}`,
        "",
        "## Recommendation Quality",
        "",
        `- ${status.recommendationQuality}`,
        "",
        "## Cache Status",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Cache Size | ${status.cacheStatus.size} |`,
        `| Hits | ${status.cacheStatus.hits} |`,
        `| Misses | ${status.cacheStatus.misses} |`,
        `| Hit Rate | ${status.cacheStatus.hitRate}% |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 4C Knowledge Retrieval Engine validation complete. Awaiting user approval before Step 4D.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-knowledge-retrieval-engine.js.map