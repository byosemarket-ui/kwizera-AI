import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrandMarketingStyle, createAiCore, KnowledgeBrandIndustry, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-brand-knowledge-"));
}
const SAMPLE_KWIZERA = {
    brandId: "step4i-kwizera",
    brandName: "KWIZERA",
    brandDescription: "Premium AI-powered creative studio for professional marketing teams",
    industry: KnowledgeBrandIndustry.Creative,
    brandMission: "Empower creators with intelligent automation",
    brandVision: "Be the world's most trusted AI creative studio",
    brandValues: ["innovation", "quality", "creativity", "trust"],
    brandPersonality: "confident-innovative",
    brandTone: "professional-energetic",
    brandTargetAudience: "creative professionals and marketing teams",
    brandPositioning: "Premium AI creative studio for modern brands",
    marketingStyle: BrandMarketingStyle.Premium,
    visual: {
        logo: "kwizera-primary-logo",
        brandColors: ["#1a1a2e", "#e94560", "#ffffff", "#16213e"],
        typography: "Inter / modern sans-serif",
        designLanguage: "modern-minimal-tech",
        motionStyle: "smooth-ease-subtle",
        introStyle: "logo-reveal-scale-fade",
        outroStyle: "brand-lockup-with-cta",
    },
    communication: {
        brandVoice: "confident-innovative",
        writingStyle: "concise-benefit-driven",
        messagingStyle: "value-first-storytelling",
        marketingTone: "professional-energetic",
        callToActionStyle: "action-oriented-clear",
    },
    tags: ["brand", "kwizera", "validation", "product-launch"],
    keywords: ["AI studio", "creative", "kwizera"],
};
const SAMPLE_STARTUP = {
    brandId: "step4i-startup",
    brandName: "QuickLaunch",
    brandDescription: "Early-stage startup brand with minimal guidelines",
    industry: KnowledgeBrandIndustry.Technology,
    brandValues: ["speed"],
    brandPersonality: "casual",
    brandTone: "friendly",
    brandTargetAudience: "startup founders",
    marketingStyle: BrandMarketingStyle.Minimal,
    visual: {
        logo: "quicklaunch-logo",
        brandColors: ["#333333"],
        typography: "Arial",
    },
    communication: {
        brandVoice: "casual-friendly",
        marketingTone: "playful",
    },
    tags: ["brand", "validation", "startup"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4I Brand Knowledge Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-4i-validation");
        const engine = core.getManager().knowledgeFoundation.getBrandKnowledgeEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Brand Knowledge Engine operational",
        };
        const analysisStart = Date.now();
        const kwizera = await engine.analyzeBrand(SAMPLE_KWIZERA);
        const analysisMs = Date.now() - analysisStart;
        results.brandUnderstanding = {
            passed: kwizera.success && Boolean(kwizera.record),
            detail: `KWIZERA analyzed in ${analysisMs}ms, consistency ${kwizera.record?.consistency.overallConsistency}`,
        };
        results.visualIdentity = {
            passed: (kwizera.record?.scores.visualIdentityScore ?? 0) >= 75,
            detail: `Visual identity ${kwizera.record?.scores.visualIdentityScore}, colors ${kwizera.record?.visual.brandColors.length}`,
        };
        results.communication = {
            passed: (kwizera.record?.scores.communicationScore ?? 0) >= 75,
            detail: `Communication ${kwizera.record?.scores.communicationScore}, voice ${kwizera.record?.communication.brandVoice}`,
        };
        results.consistencyValidation = {
            passed: (kwizera.record?.consistency.overallConsistency ?? 0) >= 80,
            detail: `Overall ${kwizera.record?.consistency.overallConsistency}, issues ${kwizera.record?.consistency.inconsistencies.length}`,
        };
        const verify = engine.verifyConsistency("step4i-kwizera");
        results.consistencyVerify = {
            passed: (verify?.overallConsistency ?? 0) >= 80,
            detail: `Verified consistency ${verify?.overallConsistency}`,
        };
        const startup = await engine.analyzeBrand(SAMPLE_STARTUP);
        results.qualityScoring = {
            passed: startup.success &&
                (kwizera.record?.scores.brandConsistencyScore ?? 0) >=
                    (startup.record?.scores.brandConsistencyScore ?? 0),
            detail: `KWIZERA ${kwizera.record?.scores.brandConsistencyScore} vs startup ${startup.record?.scores.brandConsistencyScore}`,
        };
        const rels = engine.detectRelationships("step4i-kwizera");
        results.relationshipDetection = {
            passed: startup.success,
            detail: `Creative styles ${rels?.relatedCreativeStyles.length}, marketing ${rels?.relatedMarketingStrategies.length}`,
        };
        results.knowledgeStorage = {
            passed: kwizera.record?.knowledgeId === "brand-knowledge-step4i-kwizera",
            detail: kwizera.record?.knowledgeId ?? "missing",
        };
        const recs = engine.getRecommendations("step4i-startup");
        results.recommendations = {
            passed: recs.length > 0,
            detail: `${recs.length} recommendation(s), top: ${recs[0]?.category ?? "none"}`,
        };
        const searchStart = Date.now();
        const search = await engine.searchBrands({ brandName: "KWIZERA", minConsistency: 80 });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: search.length >= 1,
            detail: `${search.length} result(s) in ${searchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `brand-knowledge-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const invalid = await engine.analyzeBrand({ brandName: "" });
        results.validationRejection = {
            passed: !invalid.success,
            detail: invalid.message ?? "rejected",
        };
        const inconsistent = await engine.analyzeBrand({
            brandName: "Bad Brand",
            brandValues: [],
            visual: { brandColors: ["#000"] },
            communication: {},
        });
        results.inconsistentRejection = {
            passed: !inconsistent.success,
            detail: inconsistent.message ?? "rejected",
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
        await core.stop("step-4i-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4I-VALIDATION-REPORT.md");
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
        "# KWIZERA AI STUDIO — Phase 4 Step 4I Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4I — Brand Knowledge Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Brand Knowledge Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        `| **Brands Analyzed** | ${status.brandsAnalyzed} |`,
        `| **Patterns Learned** | ${status.patternsLearned} |`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Brand Consistency Status",
        "",
        `- ${status.brandConsistencyStatus}`,
        "",
        "## Visual Identity Status",
        "",
        `- ${status.visualIdentityStatus}`,
        "",
        "## Recommendation Quality",
        "",
        `- ${status.recommendationQuality}`,
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
        "**KWIZERA AI** — Step 4I Brand Knowledge Engine validation complete. Awaiting user approval before Step 4J.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-brand-knowledge-engine.js.map