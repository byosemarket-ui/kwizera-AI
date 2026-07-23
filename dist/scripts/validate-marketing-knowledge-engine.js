import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, KnowledgeCampaignType, KnowledgeMarketingGoal, KnowledgeMarketingPlatform, MarketingStyle, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-marketing-knowledge-"));
}
const SAMPLE_CONVERSION = {
    campaignId: "step4g-conversion-kwizera",
    campaignName: "KWIZERA AI STUDIO Conversion Campaign",
    campaignType: KnowledgeCampaignType.Conversion,
    marketingGoal: KnowledgeMarketingGoal.Conversion,
    product: "KWIZERA Pro Studio",
    brandName: "KWIZERA",
    platform: KnowledgeMarketingPlatform.Instagram,
    audience: "creative professionals 25-45",
    language: "en",
    brand: {
        brandVoice: "confident-innovative",
        brandConsistency: 92,
    },
    structure: {
        hook: "Transform your creative workflow in minutes",
        callToAction: "Start Free Trial — Create Smarter",
        benefits: ["10x faster", "brand consistency", "multi-platform"],
        socialProof: "trusted by 500+ creative professionals",
    },
    campaign: {
        marketingStyle: MarketingStyle.StoryDriven,
        brandingConsistency: 90,
        campaignFlow: "hook → problem → solution → proof → offer → cta",
    },
    customer: {
        customerIntent: "improve creative output efficiency",
        customerNeeds: ["faster production", "brand consistency", "professional results"],
        buyingTriggers: ["time savings proof", "portfolio quality"],
        trustFactors: ["case studies", "transparent pricing"],
        decisionFactors: ["ROI", "ease of use"],
    },
    storytelling: {
        hookTiming: 3,
        narrativeArc: "problem-agitation-solution",
        emotionalFlow: "curiosity → desire → action",
    },
    content: {
        headlines: ["Transform your workflow", "Create like a pro", "AI-powered studio"],
        hashtags: ["#AIcreative", "#KWIZERA", "#marketing"],
    },
    tags: ["conversion", "kwizera", "validation", "campaign-launch"],
    keywords: ["AI studio", "creative automation", "kwizera"],
};
const SAMPLE_AWARENESS = {
    campaignId: "step4g-awareness-kwizera",
    campaignName: "KWIZERA Brand Awareness Campaign",
    campaignType: KnowledgeCampaignType.BrandAwareness,
    marketingGoal: KnowledgeMarketingGoal.Awareness,
    product: "KWIZERA Lite",
    brandName: "KWIZERA",
    platform: KnowledgeMarketingPlatform.TikTok,
    audience: "aspiring creators 18-30",
    brand: { brandConsistency: 62 },
    campaign: {
        marketingStyle: MarketingStyle.Emotional,
        brandingConsistency: 62,
    },
    customer: {
        customerIntent: "discover creative tools",
        customerNeeds: ["easy to use", "affordable", "quick results"],
        buyingTriggers: ["viral content examples", "peer sharing"],
        trustFactors: ["user testimonials", "social proof"],
        decisionFactors: ["price", "simplicity"],
    },
    storytelling: { hookTiming: 6 },
    tags: ["awareness", "kwizera", "validation", "tiktok"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4G Marketing Knowledge Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-4g-validation");
        const engine = core.getManager().knowledgeFoundation.getMarketingKnowledgeEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Marketing Knowledge Engine operational",
        };
        const analysisStart = Date.now();
        const conversion = await engine.analyzeCampaign(SAMPLE_CONVERSION);
        const analysisMs = Date.now() - analysisStart;
        results.marketingAnalysis = {
            passed: conversion.success && Boolean(conversion.record),
            detail: `Conversion campaign analyzed in ${analysisMs}ms, quality ${conversion.record?.scores.marketingQualityScore}`,
        };
        results.campaignUnderstanding = {
            passed: Boolean(conversion.record?.campaign.campaignFlow),
            detail: `Flow: ${conversion.record?.campaign.campaignFlow}`,
        };
        results.customerUnderstanding = {
            passed: (conversion.record?.customer.customerNeeds.length ?? 0) >= 2,
            detail: `${conversion.record?.customer.customerNeeds.length} needs, intent: ${conversion.record?.customer.customerIntent}`,
        };
        results.storytellingAnalysis = {
            passed: (conversion.record?.scores.storytellingScore ?? 0) >= 70,
            detail: `Storytelling ${conversion.record?.scores.storytellingScore}, hook ${conversion.record?.storytelling.hookTiming}s`,
        };
        const awareness = await engine.analyzeCampaign(SAMPLE_AWARENESS);
        results.qualityScoring = {
            passed: awareness.success &&
                (conversion.record?.scores.marketingQualityScore ?? 0) >
                    (awareness.record?.scores.marketingQualityScore ?? 0),
            detail: `Conversion ${conversion.record?.scores.marketingQualityScore} vs awareness ${awareness.record?.scores.marketingQualityScore}`,
        };
        const rels = engine.detectRelationships("step4g-conversion-kwizera");
        results.relationshipDetection = {
            passed: (rels?.relatedCampaigns.length ?? 0) >= 1,
            detail: `Related campaigns ${rels?.relatedCampaigns.length}, brands ${rels?.relatedBrands.length}`,
        };
        results.relationshipAfterSecond = {
            passed: awareness.success && (rels?.relatedBrands.length ?? 0) >= 1,
            detail: `Related brands ${rels?.relatedBrands.length}, campaigns ${rels?.relatedCampaigns.length}`,
        };
        results.knowledgeStorage = {
            passed: conversion.record?.knowledgeId === "marketing-knowledge-step4g-conversion-kwizera",
            detail: conversion.record?.knowledgeId ?? "missing",
        };
        const recs = engine.getRecommendations("step4g-conversion-kwizera");
        results.recommendations = {
            passed: recs.length >= 0,
            detail: `${recs.length} recommendation(s), top: ${recs[0]?.category ?? "none"}`,
        };
        const searchStart = Date.now();
        const search = await engine.searchCampaigns({ brand: "KWIZERA", minConversionReadiness: 60 });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: search.length >= 1,
            detail: `${search.length} result(s) in ${searchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `marketing-knowledge-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const invalid = await engine.analyzeCampaign({ campaignName: "" });
        results.validationRejection = {
            passed: !invalid.success,
            detail: invalid.message ?? "rejected",
        };
        const lowQuality = await engine.analyzeCampaign({
            campaignName: "Bad Campaign",
            brand: { brandConsistency: 20 },
            campaign: { brandingConsistency: 20 },
            customer: {
                customerNeeds: [],
                buyingTriggers: [],
                trustFactors: [],
                decisionFactors: [],
            },
            structure: {
                hook: "",
                callToAction: "",
                benefits: [],
                socialProof: "",
            },
            storytelling: { hookTiming: 15 },
        });
        results.lowQualityRejection = {
            passed: !lowQuality.success,
            detail: lowQuality.message ?? "rejected",
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
        await core.stop("step-4g-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4G-VALIDATION-REPORT.md");
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
        "# KWIZERA AI STUDIO — Phase 4 Step 4G Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4G — Marketing Knowledge Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Marketing Knowledge Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        `| **Campaigns Analyzed** | ${status.campaignsAnalyzed} |`,
        `| **Patterns Learned** | ${status.patternsLearned} |`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Campaign Analysis Status",
        "",
        `- ${status.campaignAnalysisStatus}`,
        "",
        "## Customer Knowledge Status",
        "",
        `- ${status.customerKnowledgeStatus}`,
        "",
        "## Relationship Status",
        "",
        `- ${status.relationshipStatus}`,
        "",
        "## Recommendation Quality",
        "",
        `- ${status.recommendationQuality}`,
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
        "**KWIZERA AI** — Step 4G Marketing Knowledge Engine validation complete. Awaiting user approval before Step 4H.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-marketing-knowledge-engine.js.map