import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, MarketingObjective, StrategyMarketingPlatform, ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, StrategyType, BusinessGoalType, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-marketing-strategy-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step5e-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    model: "KWP-PRO-2026",
    sku: "KWZ-PRO-STUDIO-001",
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
    productId: "step5e-kwizera-jacket",
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
    productId: "step5e-glow-serum",
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
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 5E Marketing Strategy Intelligence Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-5e-validation");
        const foundation = core.getManager().productIntelligenceFoundation;
        const analysisEngine = foundation.getProductAnalysisEngine();
        const understandingEngine = foundation.getProductUnderstandingEngine();
        const audienceEngine = foundation.getTargetAudienceIntelligenceEngine();
        const engine = foundation.getMarketingStrategyIntelligenceEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Marketing Strategy Intelligence Engine operational",
        };
        await analysisEngine.analyzeProduct(SAMPLE_TECH);
        await understandingEngine.understandProduct({
            productId: "step5e-kwizera-pro",
            marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
        });
        const techAudience = await audienceEngine.analyzeAudience({
            productId: "step5e-kwizera-pro",
            preferredLanguage: "en",
        });
        results.audienceIntelligenceIntegration = {
            passed: techAudience.success && Boolean(techAudience.record?.validated),
            detail: `Audience ${techAudience.record?.profile.audienceName} linked before strategy`,
        };
        const strategyStart = Date.now();
        const tech = await engine.prepareMarketingStrategy({
            productId: "step5e-kwizera-pro",
            marketingObjective: MarketingObjective.ProductLaunch,
            audienceId: techAudience.record?.audienceId,
            preferredPlatforms: [StrategyMarketingPlatform.YouTube, StrategyMarketingPlatform.Website],
        });
        const strategyMs = Date.now() - strategyStart;
        results.strategyAnalysis = {
            passed: tech.success && Boolean(tech.record),
            detail: `Technology strategy prepared in ${strategyMs}ms, quality ${tech.record?.scores.strategyQualityScore}`,
        };
        results.businessGoalAnalysis = {
            passed: (tech.record?.businessGoals.salesObjectives.length ?? 0) >= 1 &&
                (tech.record?.businessGoals.marketingObjectives.length ?? 0) >= 1 &&
                (tech.record?.businessGoals.brandObjectives.length ?? 0) >= 1,
            detail: `Sales ${tech.record?.businessGoals.salesObjectives.length}, marketing ${tech.record?.businessGoals.marketingObjectives.length}, brand ${tech.record?.businessGoals.brandObjectives.length}`,
        };
        results.audienceAlignment = {
            passed: (tech.record?.audienceAlignment.customerNeeds.length ?? 0) >= 2 &&
                (tech.record?.audienceAlignment.preferredPlatforms.length ?? 0) >= 1 &&
                (tech.record?.scores.audienceAlignmentScore ?? 0) >= 50,
            detail: `Audience alignment ${tech.record?.scores.audienceAlignmentScore}, platforms ${tech.record?.audienceAlignment.preferredPlatforms.join(", ")}`,
        };
        results.strategySelection = {
            passed: tech.record?.selectedStrategies.some((s) => s.priority === "primary") === true &&
                (tech.record?.selectedStrategies.length ?? 0) >= 2,
            detail: `Primary: ${tech.record?.selectedStrategies.find((s) => s.priority === "primary")?.strategyType}, total ${tech.record?.selectedStrategies.length}`,
        };
        results.creativePreparation = {
            passed: Boolean(tech.record?.creativePreparation.storyboardDirection) &&
                Boolean(tech.record?.creativePreparation.scriptPlanningDirection) &&
                !tech.record?.creativePreparation.storyboardDirection.includes("generate"),
            detail: "Strategic creative direction prepared (no asset generation)",
        };
        results.campaignDirection = {
            passed: Boolean(tech.record?.campaignDirection.campaignFocus) &&
                Boolean(tech.record?.campaignDirection.channelStrategy) &&
                tech.record?.campaignDirection.campaignReady === true,
            detail: tech.record?.campaignDirection.campaignFocus ?? "missing",
        };
        await analysisEngine.analyzeProduct(SAMPLE_FASHION);
        await analysisEngine.analyzeProduct(SAMPLE_BEAUTY);
        await understandingEngine.understandProduct({ productId: "step5e-kwizera-jacket" });
        await understandingEngine.understandProduct({ productId: "step5e-glow-serum" });
        await audienceEngine.analyzeAudience({ productId: "step5e-kwizera-jacket" });
        await audienceEngine.analyzeAudience({ productId: "step5e-glow-serum" });
        const fashion = await engine.prepareMarketingStrategy({
            productId: "step5e-kwizera-jacket",
            marketingObjective: MarketingObjective.BrandAwareness,
        });
        const beauty = await engine.prepareMarketingStrategy({
            productId: "step5e-glow-serum",
            marketingObjective: MarketingObjective.SalesGrowth,
        });
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.selectedStrategies[0]?.strategyType}, Beauty ${beauty.record?.selectedStrategies[0]?.strategyType}`,
        };
        results.strategyScores = {
            passed: (tech.record?.scores.strategyQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.businessAlignmentScore ?? 0) >= 50 &&
                (tech.record?.scores.marketingReadinessScore ?? 0) >= 40 &&
                (tech.record?.scores.confidenceScore ?? 0) >= 55,
            detail: `Quality ${tech.record?.scores.strategyQualityScore}, business ${tech.record?.scores.businessAlignmentScore}, readiness ${tech.record?.scores.marketingReadinessScore}, confidence ${tech.record?.scores.confidenceScore}`,
        };
        results.relationshipDetection = {
            passed: (tech.record?.relationships.products.length ?? 0) >= 1 &&
                (tech.record?.relationships.brands.length ?? 0) >= 1 &&
                (tech.record?.relationships.audiences.length ?? 0) >= 1,
            detail: `Products ${tech.record?.relationships.products.length}, brands ${tech.record?.relationships.brands.length}, audiences ${tech.record?.relationships.audiences.length}`,
        };
        const noUnderstanding = await engine.prepareMarketingStrategy({
            productId: "step5e-nonexistent",
            marketingObjective: MarketingObjective.ProductPromotion,
        });
        results.incompleteRejection = {
            passed: !noUnderstanding.success,
            detail: noUnderstanding.message ?? "Rejected without understanding",
        };
        const repaired = await engine.repairStrategy("step5e-kwizera-jacket", MarketingObjective.ProductPromotion);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Strategy repair pipeline verified" : "Repair failed",
        };
        const goalSearch = engine.searchStrategies({ marketingGoal: MarketingObjective.ProductLaunch });
        results.searchByGoal = {
            passed: goalSearch.length >= 1,
            detail: `${goalSearch.length} result(s) by marketing goal`,
        };
        const strategySearch = engine.searchStrategies({ strategyType: StrategyType.Storytelling });
        results.searchByStrategy = {
            passed: strategySearch.length >= 1,
            detail: `${strategySearch.length} result(s) by strategy type`,
        };
        const brandSearch = engine.searchStrategies({ brand: "KWIZERA" });
        results.searchByBrand = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const platformSearch = engine.searchStrategies({ platform: StrategyMarketingPlatform.YouTube });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const businessSearch = engine.searchStrategies({ businessGoal: BusinessGoalType.Sales });
        results.searchByBusinessGoal = {
            passed: businessSearch.length >= 1,
            detail: `${businessSearch.length} result(s) by business goal`,
        };
        const audienceSearch = engine.searchStrategies({
            audience: tech.record?.audienceAlignment.targetAudience.split(" ")[0] ?? "creative",
        });
        results.searchByAudience = {
            passed: audienceSearch.length >= 1,
            detail: `${audienceSearch.length} result(s) by audience`,
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageStrategyMs < 120000,
            detail: `avg strategy ${status.performance.averageStrategyMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `marketing-strategy-intelligence-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("marketing-strategy-intelligence");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        results.recommendationReadiness = {
            passed: tech.record?.validated === true &&
                tech.record.creativePreparation.productionPlanningReady === true &&
                Boolean(tech.record.audienceId),
            detail: "Validated strategy with audience intelligence ready for downstream creative modules",
        };
        await core.stop("step-5e-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Marketing-Strategy-Report.md"), buildMarketingStrategyReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Business-Goal-Report.md"), buildBusinessGoalReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Strategy-Readiness-Report.md"), buildStrategyReadinessReport(status, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-5E-VALIDATION-REPORT.md"), buildMarketingStrategyReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
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
function buildMarketingStrategyReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# Marketing Strategy Report — Step 5E",
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
        "## Strategies Prepared",
        "",
        `- Technology: ${tech?.marketingObjective ?? "n/a"} — primary ${tech?.selectedStrategies.find((s) => s.priority === "primary")?.strategyType ?? "n/a"} (${tech?.scores.strategyQualityScore ?? 0}/100)`,
        `- Fashion: ${fashion?.marketingObjective ?? "n/a"} — primary ${fashion?.selectedStrategies.find((s) => s.priority === "primary")?.strategyType ?? "n/a"} (${fashion?.scores.strategyQualityScore ?? 0}/100)`,
        `- Beauty: ${beauty?.marketingObjective ?? "n/a"} — primary ${beauty?.selectedStrategies.find((s) => s.priority === "primary")?.strategyType ?? "n/a"} (${beauty?.scores.strategyQualityScore ?? 0}/100)`,
        "",
        `Strategies prepared: ${status.strategiesPrepared}`,
        `Average strategy quality: ${status.averageStrategyQualityScore}/100`,
        `Average audience alignment: ${status.averageAudienceAlignmentScore}/100`,
        "",
    ].join("\n");
}
function buildBusinessGoalReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Business Goal Report — Step 5E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Objective | Sales Goals | Marketing Goals | Brand Goals | Business Alignment |",
        "|---------|-----------|-------------|-----------------|-------------|-------------------|",
        ...rows.map((r) => `| ${r.productId} | ${r.marketingObjective} | ${r.businessGoals.salesObjectives.length} | ${r.businessGoals.marketingObjectives.length} | ${r.businessGoals.brandObjectives.length} | ${r.scores.businessAlignmentScore}/100 |`),
        "",
        "## Goal Categories Supported",
        "",
        "- Sales Objectives",
        "- Marketing Objectives",
        "- Brand Objectives",
        "- Customer Objectives",
        "- Growth Objectives",
        "- Communication Objectives",
        "",
    ].join("\n");
}
function buildStrategyReadinessReport(status, tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Strategy Readiness Report — Step 5E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Marketing Readiness | Confidence | Storyboard | Script | Visual | Production | Validated |",
        "|---------|---------------------|------------|------------|--------|--------|------------|-----------|",
        ...rows.map((r) => `| ${r.productId} | ${r.scores.marketingReadinessScore}/100 | ${r.scores.confidenceScore}/100 | ${r.creativePreparation.storyboardReady ? "✅" : "❌"} | ${r.creativePreparation.scriptPlanningReady ? "✅" : "❌"} | ${r.creativePreparation.visualPlanningReady ? "✅" : "❌"} | ${r.creativePreparation.productionPlanningReady ? "✅" : "❌"} | ${r.validated ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average strategy analysis: ${status.performance.averageStrategyMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- Average relationship detection: ${status.performance.averageRelationshipMs}ms`,
        "",
        "## Recommendation Readiness",
        "",
        "All validated strategies include primary strategy selection, audience alignment, business goal mapping, and creative strategic direction for downstream modules.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-marketing-strategy-intelligence-engine.js.map