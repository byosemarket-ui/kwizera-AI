import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, KnowledgeCreativeDirectionStyle, KnowledgeCreativeDomain, KnowledgeCreativeMarketingGoal, KnowledgeCreativePlatform, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-creative-knowledge-"));
}
const SAMPLE_PROMO = {
    creativeId: "step4k-kwizera-promo",
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
    tags: ["creative", "kwizera", "validation", "video"],
};
const SAMPLE_POSTER = {
    creativeId: "step4k-kwizera-poster",
    projectName: "KWIZERA Launch Poster",
    domain: KnowledgeCreativeDomain.PosterDesign,
    creativeStyle: KnowledgeCreativeDirectionStyle.Bold,
    platform: KnowledgeCreativePlatform.Facebook,
    brandName: "KWIZERA",
    visual: { balance: 72, contrast: 70, whiteSpace: 65 },
    storytelling: { attentionRetention: 70 },
    animation: { animationQuality: 65 },
    tags: ["creative", "kwizera", "validation", "image"],
};
const SAMPLE_SOCIAL = {
    creativeId: "step4k-social-short",
    projectName: "KWIZERA TikTok Short",
    domain: KnowledgeCreativeDomain.SocialMediaDesign,
    creativeStyle: KnowledgeCreativeDirectionStyle.Playful,
    platform: KnowledgeCreativePlatform.TikTok,
    brandName: "KWIZERA",
    visual: { balance: 80, contrast: 82 },
    storytelling: { attentionRetention: 88 },
    animation: { animationQuality: 85 },
    tags: ["creative", "kwizera", "validation", "video"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4K Creative Knowledge Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-4k-validation");
        const engine = core.getManager().knowledgeFoundation.getCreativeKnowledgeEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Creative Knowledge Engine operational",
        };
        const analysisStart = Date.now();
        const promo = await engine.analyzeCreative(SAMPLE_PROMO);
        const analysisMs = Date.now() - analysisStart;
        results.creativeUnderstanding = {
            passed: promo.success && Boolean(promo.record),
            detail: `Promo analyzed in ${analysisMs}ms, quality ${promo.record?.scores.creativeQualityScore}`,
        };
        results.designKnowledge = {
            passed: (promo.record?.scores.visualDesignScore ?? 0) >= 75,
            detail: `Visual design ${promo.record?.scores.visualDesignScore}, layout ${promo.record?.visual.layout}`,
        };
        results.storytellingKnowledge = {
            passed: (promo.record?.scores.storytellingScore ?? 0) >= 75,
            detail: `Storytelling ${promo.record?.scores.storytellingScore}, retention ${promo.record?.storytelling.attentionRetention}`,
        };
        results.animationKnowledge = {
            passed: (promo.record?.scores.animationScore ?? 0) >= 75,
            detail: `Animation ${promo.record?.scores.animationScore}, style ${promo.record?.animationStyle}`,
        };
        const poster = await engine.analyzeCreative(SAMPLE_POSTER);
        await engine.analyzeCreative(SAMPLE_SOCIAL);
        results.qualityScoring = {
            passed: poster.success &&
                (promo.record?.scores.creativeQualityScore ?? 0) >=
                    (poster.record?.scores.creativeQualityScore ?? 0),
            detail: `Promo ${promo.record?.scores.creativeQualityScore} vs poster ${poster.record?.scores.creativeQualityScore}`,
        };
        const rels = engine.detectRelationships("step4k-kwizera-promo");
        results.relationshipDetection = {
            passed: (rels?.relatedBrands.length ?? 0) >= 1,
            detail: `Brands ${rels?.relatedBrands.length}, styles ${rels?.creativeStyles.length}`,
        };
        results.knowledgeStorage = {
            passed: promo.record?.knowledgeId === "creative-knowledge-step4k-kwizera-promo",
            detail: promo.record?.knowledgeId ?? "missing",
        };
        const recs = engine.getRecommendations("step4k-kwizera-poster");
        results.recommendations = {
            passed: recs.length > 0,
            detail: `${recs.length} recommendation(s), top: ${recs[0]?.category ?? "none"}`,
        };
        const searchStart = Date.now();
        const search = await engine.searchCreatives({ brand: "KWIZERA", minCreativeQuality: 70 });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: search.length >= 2,
            detail: `${search.length} result(s) in ${searchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `creative-knowledge-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const invalid = await engine.analyzeCreative({ projectName: "" });
        results.validationRejection = {
            passed: !invalid.success,
            detail: invalid.message ?? "rejected",
        };
        const poor = await engine.analyzeCreative({
            projectName: "Poor Creative",
            visual: { balance: 20, contrast: 20, negativeSpace: 20, whiteSpace: 20 },
            storytelling: { attentionRetention: 25 },
            animation: { animationQuality: 20, motionPrinciples: [] },
            cinematic: { visualContinuity: 20 },
        });
        results.poorQualityRejection = {
            passed: !poor.success,
            detail: poor.message ?? "rejected",
        };
        const report = engine.buildStatusReport();
        results.performance = {
            passed: analysisMs < 15000 && searchMs < 10000,
            detail: `analysis ${analysisMs}ms, search ${searchMs}ms`,
        };
        results.readiness = {
            passed: report.readinessScore === 100,
            detail: `Readiness ${report.readinessScore}/100`,
        };
        await core.stop("step-4k-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4K-VALIDATION-REPORT.md");
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
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildReport(status, results, storageRoot, allPassed) {
    return [
        "# KWIZERA AI STUDIO — Phase 4 Step 4K Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4K — Creative Knowledge Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Creative Knowledge Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        `| **Projects Analyzed** | ${status.projectsAnalyzed} |`,
        `| **Patterns Learned** | ${status.patternsLearned} |`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Design Knowledge Status",
        "",
        `- ${status.designKnowledgeStatus}`,
        "",
        "## Storytelling Status",
        "",
        `- ${status.storytellingStatus}`,
        "",
        "## Animation Knowledge Status",
        "",
        `- ${status.animationKnowledgeStatus}`,
        "",
        "## Relationship Status",
        "",
        `- ${status.relationshipStatus}`,
        "",
        "## Performance",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Average Analysis | ${status.performance.averageAnalysisMs}ms |`,
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
        "**KWIZERA AI** — Step 4K Creative Knowledge Engine validation complete. Awaiting user approval before Step 4L.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-creative-knowledge-engine.js.map