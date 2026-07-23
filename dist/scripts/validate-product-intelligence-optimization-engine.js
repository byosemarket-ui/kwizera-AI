import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-pi-optimization-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step5m-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation empowering marketing teams to produce brand-consistent content at scale",
    features: ["AI video generation", "brand consistency", "multi-platform export"],
    specifications: { license: "pro", deployment: "cloud" },
    materials: ["digital-license"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Technology,
    useCase: "creative-production",
    targetCustomer: "creative professionals and marketing teams",
    businessType: ProductBusinessType.B2B,
    tags: ["software", "validation"],
    keywords: ["AI studio", "kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step5m-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium urban jacket for creators who need weather-resistant style on the move",
    features: ["water-resistant", "breathable", "minimal branding"],
    specifications: { fabric: "cotton-blend" },
    materials: ["cotton", "polyester"],
    price: 129.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Fashion,
    businessType: ProductBusinessType.D2C,
    tags: ["fashion", "validation"],
    keywords: ["jacket", "kwizera"],
};
const SAMPLE_BEAUTY = {
    productId: "step5m-glow-serum",
    productName: "Radiance Vitamin C Serum",
    category: ProductAnalysisCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    description: "Clinical-grade vitamin C serum delivering radiant skin and anti-aging benefits",
    features: ["vitamin-c", "anti-aging", "hydrating"],
    specifications: { volume: "30ml" },
    materials: ["glass-bottle"],
    price: 45.0,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Beauty,
    tags: ["beauty", "validation"],
    keywords: ["serum", "glowlab"],
};
async function prepareFullPipeline(foundation, sample, objective, platform) {
    await foundation.getProductAnalysisEngine().analyzeProduct(sample);
    await foundation.getProductUnderstandingEngine().understandProduct({
        productId: sample.productId,
        marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });
    await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
        productId: sample.productId,
    });
    await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
        productId: sample.productId,
        marketingObjective: objective,
    });
    await foundation.getCreativeDirectionEngine().planCreativeDirection({
        productId: sample.productId,
        platform,
        campaignGoal: objective,
    });
    await foundation.getStoryboardIntelligenceEngine().createStoryboard({
        productId: sample.productId,
    });
    await foundation.getScriptPlanningEngine().createScriptPlan({
        productId: sample.productId,
    });
    await foundation.getVisualPlanningEngine().createVisualPlan({
        productId: sample.productId,
    });
    await foundation.getAudioPlanningEngine().createAudioPlan({
        productId: sample.productId,
    });
    await foundation.getProductionPlanningEngine().createProductionPlan({
        productId: sample.productId,
    });
    await foundation.getQualityPredictionEngine().predictQuality({
        productId: sample.productId,
    });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 5M Product Intelligence Optimization Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-5m-validation");
        const foundation = core.getManager().productIntelligenceFoundation;
        const engine = foundation.getProductIntelligenceOptimizationEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Product Intelligence Optimization Engine operational",
        };
        await prepareFullPipeline(foundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        const optStart = Date.now();
        const tech = await engine.runOptimization({ productId: "step5m-kwizera-pro" });
        const optMs = Date.now() - optStart;
        results.optimizationRun = {
            passed: tech.success && Boolean(tech.record),
            detail: `Technology optimization in ${optMs}ms, improvement ${tech.record?.scores.overallImprovementScore}`,
        };
        results.optimizationProfile = {
            passed: Boolean(tech.record?.profile.optimizationId) &&
                Boolean(tech.record?.profile.productId) &&
                Boolean(tech.record?.recoveryPointId),
            detail: `Optimization ${tech.record?.profile.optimizationId}, v${tech.record?.profile.optimizationVersion}`,
        };
        results.moduleOptimization = {
            passed: (tech.record?.moduleResults.length ?? 0) === 11 &&
                tech.record?.moduleResults.every((m) => m.qualityScoreAfter >= m.qualityScoreBefore) === true,
            detail: `${tech.record?.moduleResults.length} modules optimized without quality reduction`,
        };
        results.optimizationStrategies = {
            passed: Boolean(tech.record?.strategies.cacheOptimization) &&
                Boolean(tech.record?.strategies.searchOptimization) &&
                Boolean(tech.record?.strategies.performanceOptimization),
            detail: "All optimization strategy categories applied",
        };
        results.cacheOptimization = {
            passed: (tech.record?.cache.products.length ?? 0) >= 1 &&
                (tech.record?.cache.brands.length ?? 0) >= 1 &&
                (tech.record?.cache.storyboards.length ?? 0) >= 1 &&
                (tech.record?.cache.hitRate ?? 0) > 0,
            detail: `Cache hit rate ${tech.record?.cache.hitRate}%, ${tech.record?.cache.visualPlans.length} visual plans cached`,
        };
        results.performanceImprovement = {
            passed: (tech.record?.performance.planningSpeedMs ?? 999) <= (tech.record?.performance.planningSpeedBeforeMs ?? 0) &&
                (tech.record?.scores.planningImprovementScore ?? 0) >= 0,
            detail: `Planning ${tech.record?.performance.planningSpeedBeforeMs}ms → ${tech.record?.performance.planningSpeedMs}ms`,
        };
        results.recommendationImprovement = {
            passed: (tech.record?.scores.recommendationImprovementScore ?? 0) >= 5,
            detail: `Recommendation improvement ${tech.record?.scores.recommendationImprovementScore}/100`,
        };
        results.relationshipImprovement = {
            passed: (tech.record?.scores.relationshipImprovementScore ?? 0) >= 5,
            detail: `Relationship improvement ${tech.record?.scores.relationshipImprovementScore}/100`,
        };
        results.workflowOptimization = {
            passed: Boolean(tech.record?.strategies.workflowOptimization) &&
                (tech.record?.scores.workflowEfficiencyScore ?? 0) >= 10,
            detail: `Workflow efficiency ${tech.record?.scores.workflowEfficiencyScore}/100`,
        };
        results.recoveryPoint = {
            passed: Boolean(tech.record?.recoveryPointId) && tech.recovered !== true,
            detail: `Recovery point ${tech.record?.recoveryPointId} created before optimization`,
        };
        results.optimizationScores = {
            passed: (tech.record?.scores.overallImprovementScore ?? 0) >= 5 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Overall ${tech.record?.scores.overallImprovementScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        await prepareFullPipeline(foundation, SAMPLE_FASHION, MarketingObjective.BrandAwareness, CreativePlatform.InstagramReels);
        await prepareFullPipeline(foundation, SAMPLE_BEAUTY, MarketingObjective.SalesGrowth, CreativePlatform.TikTok);
        const fashion = await engine.runOptimization({ productId: "step5m-kwizera-jacket" });
        const beauty = await engine.runOptimization({ productId: "step5m-glow-serum" });
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion improvement ${fashion.record?.scores.overallImprovementScore}, Beauty ${beauty.record?.scores.overallImprovementScore}`,
        };
        results.relationshipDetection = {
            passed: (tech.record?.relationships.qualityPredictions.length ?? 0) >= 1 &&
                (tech.record?.relationships.productionPlans.length ?? 0) >= 1,
            detail: `Quality predictions ${tech.record?.relationships.qualityPredictions.length}, knowledge ${tech.record?.relationships.knowledgeRecords.length}`,
        };
        const noPipeline = await engine.runOptimization({ productId: "step5m-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream pipeline",
        };
        const repaired = await engine.repairOptimization("step5m-kwizera-jacket", CreativePlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Optimization repair pipeline verified" : "Repair failed",
        };
        const recoveryId = tech.record?.recoveryPointId;
        const restoreTest = recoveryId ? engine.restoreRecoveryPoint(recoveryId) : false;
        results.recoveryValidation = {
            passed: restoreTest === true,
            detail: restoreTest ? "Recovery point restore verified" : "Recovery restore failed",
        };
        const optSearch = engine.searchOptimizations({ optimizationId: tech.record?.optimizationId });
        results.searchByOptimization = {
            passed: optSearch.length >= 1,
            detail: `${optSearch.length} result(s) by optimization`,
        };
        const brandSearch = engine.searchOptimizations({ brand: "KWIZERA" });
        results.searchByBrand = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const scoreSearch = engine.searchOptimizations({ minImprovementScore: 5 });
        results.searchByImprovementScore = {
            passed: scoreSearch.length >= 1,
            detail: `${scoreSearch.length} result(s) above improvement threshold`,
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageOptimizationMs < 120000,
            detail: `avg optimization ${status.performance.averageOptimizationMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `product-intelligence-optimization-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("product-intelligence-optimization");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        results.recommendationReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: "Optimized Product Intelligence system ready for continued operation",
        };
        await core.stop("step-5m-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Product-Optimization-Report.md"), buildProductOptimizationReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Performance-Optimization-Report.md"), buildPerformanceReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Recommendation-Optimization-Report.md"), buildRecommendationReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Workflow-Optimization-Report.md"), buildWorkflowReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-5M-VALIDATION-REPORT.md"), buildProductOptimizationReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        console.log("Reports written:", projectStateDir);
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
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
function buildProductOptimizationReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# Product Optimization Report — Step 5M",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage:** \`${storageRoot}\``,
        `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
        `**Readiness:** ${status.readinessScore}/100`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([k, r]) => `| ${k} | ${r.passed ? "✅" : "❌"} | ${r.detail} |`),
        "",
        "## Optimizations Completed",
        "",
        `- Technology: ${tech?.moduleResults.length ?? 0} modules, improvement ${tech?.scores.overallImprovementScore ?? 0}/100`,
        `- Fashion: improvement ${fashion?.scores.overallImprovementScore ?? 0}/100`,
        `- Beauty: improvement ${beauty?.scores.overallImprovementScore ?? 0}/100`,
        "",
        `Total optimizations: ${status.optimizationsCompleted}`,
        "",
    ].join("\n");
}
function buildPerformanceReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Performance Optimization Report — Step 5M",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Planning Before | Planning After | Search Before | Search After | Planning Δ | Search Δ |",
        "|---------|-----------------|----------------|---------------|--------------|------------|----------|",
        ...rows.map((r) => `| ${r.productId} | ${r.performance.planningSpeedBeforeMs}ms | ${r.performance.planningSpeedMs}ms | ${r.performance.searchSpeedBeforeMs}ms | ${r.performance.searchSpeedMs}ms | ${r.scores.planningImprovementScore}% | ${r.scores.searchImprovementScore}% |`),
        "",
        "## Resource Estimates",
        "",
        ...rows.map((r) => `- **${r.productId}:** ~${r.performance.memoryEstimateMb}MB memory, ~${r.performance.diskUsageEstimateKb}KB disk`),
        "",
    ].join("\n");
}
function buildRecommendationReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Recommendation Optimization Report — Step 5M",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.productId}`, "", `- **Recommendation Improvement:** ${record.scores.recommendationImprovementScore}/100`, `- **Confidence Improvement:** ${record.scores.confidenceImprovementScore}/100`, "", "### Strategies", `- ${record.strategies.recommendationOptimization}`, `- ${record.strategies.knowledgeRetrievalOptimization}`, "", "### Module Improvements", "| Module | Before | After | Strategies |", "|--------|--------|-------|------------|");
        for (const mod of record.moduleResults.filter((m) => m.strategiesApplied.includes("recommendation"))) {
            lines.push(`| ${mod.moduleName} | ${mod.qualityScoreBefore} | ${mod.qualityScoreAfter} | ${mod.strategiesApplied.join(", ")} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildWorkflowReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Workflow Optimization Report — Step 5M",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.productId} — ${record.profile.platform}`, "", `- **Workflow Efficiency:** ${record.scores.workflowEfficiencyScore}/100`, `- **Planning Optimization:** ${record.strategies.planningOptimization}`, `- **Workflow Optimization:** ${record.strategies.workflowOptimization}`, "", "| Module | Improved | Detail |", "|--------|----------|--------|");
        for (const mod of record.moduleResults) {
            lines.push(`| ${mod.moduleName} | ${mod.improved ? "✅" : "❌"} | ${mod.detail.slice(0, 60)}... |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
void main();
//# sourceMappingURL=validate-product-intelligence-optimization-engine.js.map