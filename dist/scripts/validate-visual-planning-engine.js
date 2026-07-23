import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-visual-planning-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step5i-kwizera-pro",
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
    productId: "step5i-kwizera-jacket",
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
    productId: "step5i-glow-serum",
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
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 5I Visual Planning Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-5i-validation");
        const foundation = core.getManager().productIntelligenceFoundation;
        const engine = foundation.getVisualPlanningEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Visual Planning Engine operational",
        };
        await prepareFullPipeline(foundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        const planStart = Date.now();
        const tech = await engine.createVisualPlan({ productId: "step5i-kwizera-pro" });
        const planMs = Date.now() - planStart;
        results.visualPlanCreation = {
            passed: tech.success && Boolean(tech.record),
            detail: `Technology visual plan created in ${planMs}ms, score ${tech.record?.scores.visualPlanningScore}`,
        };
        const storyboard = foundation
            .getStoryboardIntelligenceEngine()
            .getStoryboardsByProduct("step5i-kwizera-pro")[0];
        const scriptPlan = foundation
            .getScriptPlanningEngine()
            .getScriptPlansByProduct("step5i-kwizera-pro")[0];
        results.visualProfile = {
            passed: Boolean(tech.record?.profile.visualPlanId) &&
                Boolean(tech.record?.profile.storyboardId) &&
                Boolean(tech.record?.profile.scriptPlanId),
            detail: `Plan ${tech.record?.profile.visualPlanId}, v${tech.record?.profile.visualVersion}`,
        };
        results.sceneVisualPlanning = {
            passed: (tech.record?.scenePlans.length ?? 0) >= 5 &&
                tech.record?.scenePlans.length === storyboard?.scenes.length &&
                tech.record?.scenePlans.length === scriptPlan?.scenePlans.length &&
                tech.record?.scenePlans.every((s) => s.composition.startsWith("Plan composition")) === true,
            detail: `${tech.record?.scenePlans.length} scene visual plans aligned with storyboard and script`,
        };
        results.backgroundPlanning = {
            passed: Boolean(tech.record?.backgroundPlanning.studioBackground) &&
                Boolean(tech.record?.backgroundPlanning.brandedBackground) &&
                Boolean(tech.record?.backgroundPlanning.environmentBackground),
            detail: "Studio, branded, and environment backgrounds planned",
        };
        results.cameraPlanning = {
            passed: Boolean(tech.record?.cameraPlanning.heroShot) &&
                Boolean(tech.record?.cameraPlanning.closeUp) &&
                Boolean(tech.record?.cameraPlanning.orbit),
            detail: `Hero, close-up, and orbit camera plans prepared`,
        };
        results.compositionPlanning = {
            passed: tech.record?.scenePlans.every((s) => Boolean(s.depth) && Boolean(s.colorPalette)) === true,
            detail: "Depth and color palette planned per scene",
        };
        results.brandConsistency = {
            passed: tech.record?.brandConsistency.logoPlacement === true &&
                tech.record?.brandConsistency.brandColors === true &&
                tech.record?.brandConsistency.typography === true,
            detail: `Logo ${tech.record?.brandConsistency.logoPlacement ? "ok" : "fail"}, colors ${tech.record?.brandConsistency.brandColors ? "ok" : "fail"}`,
        };
        results.graphicElements = {
            passed: Boolean(tech.record?.graphicElements.titles) &&
                Boolean(tech.record?.graphicElements.ctaButtons) &&
                Boolean(tech.record?.graphicElements.productFeatures),
            detail: "Titles, CTA buttons, and feature callouts planned",
        };
        results.visualStyle = {
            passed: Boolean(tech.record?.visualStyle.cinematic) &&
                Boolean(tech.record?.visualStyle.technology) &&
                Boolean(tech.record?.visualStyle.modern),
            detail: "Visual style variants prepared across industries",
        };
        await prepareFullPipeline(foundation, SAMPLE_FASHION, MarketingObjective.BrandAwareness, CreativePlatform.InstagramReels);
        await prepareFullPipeline(foundation, SAMPLE_BEAUTY, MarketingObjective.SalesGrowth, CreativePlatform.TikTok);
        const fashion = await engine.createVisualPlan({ productId: "step5i-kwizera-jacket" });
        const beauty = await engine.createVisualPlan({ productId: "step5i-glow-serum" });
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.scenePlans.length} scenes, Beauty ${beauty.record?.scenePlans.length} scenes`,
        };
        results.visualScores = {
            passed: (tech.record?.scores.visualPlanningScore ?? 0) >= 55 &&
                (tech.record?.scores.compositionScore ?? 0) >= 50 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.creativeScore ?? 0) >= 50 &&
                (tech.record?.scores.marketingScore ?? 0) >= 50 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Planning ${tech.record?.scores.visualPlanningScore}, composition ${tech.record?.scores.compositionScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationshipDetection = {
            passed: (tech.record?.relationships.storyboards.length ?? 0) >= 1 &&
                (tech.record?.relationships.scriptPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.products.length ?? 0) >= 1 &&
                (tech.record?.relationships.creativeDirections.length ?? 0) >= 1 &&
                (tech.record?.relationships.marketingStrategies.length ?? 0) >= 1,
            detail: `Storyboards ${tech.record?.relationships.storyboards.length}, scripts ${tech.record?.relationships.scriptPlans.length}, production ${tech.record?.relationships.productionPlans.length}`,
        };
        const noPipeline = await engine.createVisualPlan({ productId: "step5i-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream pipeline",
        };
        const repaired = await engine.repairVisualPlan("step5i-kwizera-jacket", CreativePlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Visual plan repair pipeline verified" : "Repair failed",
        };
        const visualSearch = engine.searchVisualPlans({ visualPlanId: tech.record?.visualPlanId });
        results.searchByVisualPlan = {
            passed: visualSearch.length >= 1,
            detail: `${visualSearch.length} result(s) by visual plan`,
        };
        const brandSearch = engine.searchVisualPlans({ brand: "KWIZERA" });
        results.searchByBrand = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const platformSearch = engine.searchVisualPlans({ platform: CreativePlatform.YouTube });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const campaignSearch = engine.searchVisualPlans({ campaignGoal: MarketingObjective.ProductLaunch });
        results.searchByCampaign = {
            passed: campaignSearch.length >= 1,
            detail: `${campaignSearch.length} result(s) by campaign`,
        };
        const styleSearch = engine.searchVisualPlans({ creativeStyle: tech.record?.profile.creativeStyle });
        results.searchByCreativeStyle = {
            passed: styleSearch.length >= 1,
            detail: `${styleSearch.length} result(s) by creative style`,
        };
        const industrySearch = engine.searchVisualPlans({ industry: "technology" });
        results.searchByIndustry = {
            passed: industrySearch.length >= 1,
            detail: `${industrySearch.length} result(s) by industry`,
        };
        const sceneSearch = engine.searchVisualPlans({ sceneNumber: 1 });
        results.searchByScene = {
            passed: sceneSearch.length >= 1,
            detail: `${sceneSearch.length} result(s) containing scene 1`,
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `visual-planning-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("visual-planning");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        results.recommendationReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: "Production-ready visual plan validated for image/video generation modules",
        };
        await core.stop("step-5i-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Visual-Planning-Report.md"), buildVisualPlanningReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Camera-Planning-Report.md"), buildCameraPlanningReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Background-Planning-Report.md"), buildBackgroundPlanningReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Visual-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-5I-VALIDATION-REPORT.md"), buildVisualPlanningReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
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
function buildVisualPlanningReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# Visual Planning Report — Step 5I",
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
        "## Visual Plans Prepared",
        "",
        `- Technology: ${tech?.scenePlans.length ?? 0} scene plans on ${tech?.profile.platform ?? "n/a"} (${tech?.scores.visualPlanningScore ?? 0}/100)`,
        `- Fashion: ${fashion?.scenePlans.length ?? 0} scene plans (${fashion?.scores.visualPlanningScore ?? 0}/100)`,
        `- Beauty: ${beauty?.scenePlans.length ?? 0} scene plans (${beauty?.scores.visualPlanningScore ?? 0}/100)`,
        "",
        `Visual plans prepared: ${status.visualPlansPrepared}`,
        "",
    ].join("\n");
}
function buildCameraPlanningReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Camera Planning Report — Step 5I",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const c = record.cameraPlanning;
        lines.push(`## ${record.productId} — ${record.profile.platform}`, "", `- **Close-up:** ${c.closeUp}`, `- **Medium Shot:** ${c.mediumShot}`, `- **Wide Shot:** ${c.wideShot}`, `- **Hero Shot:** ${c.heroShot}`, `- **Orbit:** ${c.orbit}`, `- **Zoom:** ${c.zoom}`, `- **Pan:** ${c.pan}`, `- **Tilt:** ${c.tilt}`, "", "| # | Angle | Distance | Movement |", "|---|-------|----------|----------|");
        for (const scene of record.scenePlans) {
            lines.push(`| ${scene.sceneNumber} | ${scene.cameraAngle.slice(0, 30)} | ${scene.cameraDistance.slice(0, 25)} | ${scene.cameraMovement.slice(0, 30)} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildBackgroundPlanningReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Background Planning Report — Step 5I",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const b = record.backgroundPlanning;
        lines.push(`## ${record.productId}`, "", `- **Studio:** ${b.studioBackground}`, `- **Lifestyle:** ${b.lifestyleBackground}`, `- **Transparent:** ${b.transparentBackground}`, `- **Gradient:** ${b.gradientBackground}`, `- **Environment:** ${b.environmentBackground}`, `- **Branded:** ${b.brandedBackground}`, `- **Custom:** ${b.customBackground}`, "", "| # | Background Style | Lighting |", "|---|------------------|----------|");
        for (const scene of record.scenePlans) {
            lines.push(`| ${scene.sceneNumber} | ${scene.backgroundStyle.slice(0, 45)}... | ${scene.lightingDirection.slice(0, 40)}... |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Visual Readiness Report — Step 5I",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Planning | Composition | Brand | Creative | Marketing | Production Ready | Validated |",
        "|---------|----------|-------------|-------|----------|-----------|------------------|-----------|",
        ...rows.map((r) => `| ${r.productId} | ${r.scores.visualPlanningScore}/100 | ${r.scores.compositionScore}/100 | ${r.scores.brandConsistencyScore}/100 | ${r.scores.creativeScore}/100 | ${r.scores.marketingScore}/100 | ${r.productionReady ? "✅" : "❌"} | ${r.validated ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average planning: ${status.performance.averagePlanningMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- Average relationship detection: ${status.performance.averageRelationshipMs}ms`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-visual-planning-engine.js.map