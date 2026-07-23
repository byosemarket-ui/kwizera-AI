import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
import { ProductionPlanningAnalyzer } from "../ai/production-planning-engine/production-planning-analyzer.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-production-planning-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const assetAnalyzer = new ProductionPlanningAnalyzer();
const SAMPLE_TECH = {
    productId: "step5k-kwizera-pro",
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
    productId: "step5k-kwizera-jacket",
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
    productId: "step5k-glow-serum",
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
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 5K Production Planning Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-5k-validation");
        const foundation = core.getManager().productIntelligenceFoundation;
        const engine = foundation.getProductionPlanningEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Production Planning Engine operational",
        };
        await prepareFullPipeline(foundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        const planStart = Date.now();
        const tech = await engine.createProductionPlan({ productId: "step5k-kwizera-pro" });
        const planMs = Date.now() - planStart;
        results.productionPlanCreation = {
            passed: tech.success && Boolean(tech.record),
            detail: `Technology production plan created in ${planMs}ms, score ${tech.record?.scores.productionReadinessScore}`,
        };
        const storyboard = foundation
            .getStoryboardIntelligenceEngine()
            .getStoryboardsByProduct("step5k-kwizera-pro")[0];
        const audioPlan = foundation
            .getAudioPlanningEngine()
            .getAudioPlansByProduct("step5k-kwizera-pro")[0];
        results.productionProfile = {
            passed: Boolean(tech.record?.profile.productionPlanId) &&
                Boolean(tech.record?.profile.storyboardId) &&
                Boolean(tech.record?.profile.audioPlanId),
            detail: `Plan ${tech.record?.profile.productionPlanId}, v${tech.record?.profile.productionVersion}`,
        };
        results.workflowPlanning = {
            passed: Boolean(tech.record?.workflow.preProduction) &&
                Boolean(tech.record?.workflow.renderingPreparation) &&
                Boolean(tech.record?.workflow.exportPreparation) &&
                Boolean(tech.record?.workflow.deliveryPreparation),
            detail: "Pre-production through delivery workflow prepared",
        };
        const requiredAssets = assetAnalyzer.getAllRequiredAssets(tech.record.assets);
        results.assetValidation = {
            passed: requiredAssets.length >= 5 &&
                requiredAssets.every((a) => a.status === "planned" || a.status === "validated") &&
                tech.record.assets.videos.length === storyboard?.scenes.length,
            detail: `${requiredAssets.length} required assets planned, ${tech.record?.assets.videos.length} video slots`,
        };
        results.dependencyValidation = {
            passed: tech.record?.dependencies.storyboard === true &&
                tech.record?.dependencies.scriptPlan === true &&
                tech.record?.dependencies.visualPlan === true &&
                tech.record?.dependencies.audioPlan === true &&
                tech.record?.dependencies.creativeDirection === true &&
                tech.record?.dependencies.marketingStrategy === true &&
                tech.record?.dependencies.productIntelligence === true &&
                (tech.record?.dependencies.issues.length ?? 0) === 0,
            detail: `Dependencies validated — ${tech.record?.scores.dependencyScore}/100`,
        };
        results.renderPreparation = {
            passed: Boolean(tech.record?.renderPreparation.resolution) &&
                Boolean(tech.record?.renderPreparation.aspectRatio) &&
                Boolean(tech.record?.renderPreparation.frameRate) &&
                Boolean(tech.record?.renderPreparation.outputFormat),
            detail: `${tech.record?.renderPreparation.resolution} @ ${tech.record?.renderPreparation.frameRate}`,
        };
        results.exportPreparation = {
            passed: Boolean(tech.record?.exportPreparation.mp4) &&
                Boolean(tech.record?.exportPreparation.mov) &&
                Boolean(tech.record?.exportPreparation.webm) &&
                (tech.record?.exportPreparation.additionalFormats.length ?? 0) >= 1,
            detail: "MP4, MOV, WEBM, GIF and image sequence export planned",
        };
        results.recoveryPlan = {
            passed: Boolean(tech.record?.recoveryPlan.checkpointStrategy) &&
                (tech.record?.recoveryPlan.rollbackSteps.length ?? 0) >= 2,
            detail: "Checkpoint and rollback recovery planned",
        };
        results.sceneProduction = {
            passed: (tech.record?.sceneProductionPlans.length ?? 0) >= 5 &&
                tech.record?.sceneProductionPlans.length === storyboard?.scenes.length &&
                tech.record?.sceneProductionPlans.every((s) => s.renderInstructions.startsWith("Plan render")) === true,
            detail: `${tech.record?.sceneProductionPlans.length} scene production plans prepared`,
        };
        results.upstreamAlignment = {
            passed: tech.record?.storyboardId === storyboard?.storyboardId &&
                tech.record?.audioPlanId === audioPlan?.audioPlanId,
            detail: "All upstream plan IDs aligned",
        };
        await prepareFullPipeline(foundation, SAMPLE_FASHION, MarketingObjective.BrandAwareness, CreativePlatform.InstagramReels);
        await prepareFullPipeline(foundation, SAMPLE_BEAUTY, MarketingObjective.SalesGrowth, CreativePlatform.TikTok);
        const fashion = await engine.createProductionPlan({ productId: "step5k-kwizera-jacket" });
        const beauty = await engine.createProductionPlan({ productId: "step5k-glow-serum" });
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.sceneProductionPlans.length} scenes, Beauty ${beauty.record?.sceneProductionPlans.length} scenes`,
        };
        results.productionScores = {
            passed: (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.assetReadinessScore ?? 0) >= 50 &&
                (tech.record?.scores.workflowReadinessScore ?? 0) >= 50 &&
                (tech.record?.scores.dependencyScore ?? 0) >= 50 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Readiness ${tech.record?.scores.productionReadinessScore}, assets ${tech.record?.scores.assetReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationshipDetection = {
            passed: (tech.record?.relationships.storyboards.length ?? 0) >= 1 &&
                (tech.record?.relationships.audioPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.productionHistory.length ?? 0) >= 1,
            detail: `History ${tech.record?.relationships.productionHistory.length}, knowledge ${tech.record?.relationships.knowledgeRecords.length}`,
        };
        const noPipeline = await engine.createProductionPlan({ productId: "step5k-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream pipeline",
        };
        const repaired = await engine.repairProductionPlan("step5k-kwizera-jacket", CreativePlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Production plan repair pipeline verified" : "Repair failed",
        };
        const planSearch = engine.searchProductionPlans({ productionPlanId: tech.record?.productionPlanId });
        results.searchByProductionPlan = {
            passed: planSearch.length >= 1,
            detail: `${planSearch.length} result(s) by production plan`,
        };
        const brandSearch = engine.searchProductionPlans({ brand: "KWIZERA" });
        results.searchByBrand = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const platformSearch = engine.searchProductionPlans({ platform: CreativePlatform.YouTube });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const campaignSearch = engine.searchProductionPlans({ campaignGoal: MarketingObjective.ProductLaunch });
        results.searchByCampaign = {
            passed: campaignSearch.length >= 1,
            detail: `${campaignSearch.length} result(s) by campaign`,
        };
        const workflowSearch = engine.searchProductionPlans({ workflow: "rendering" });
        results.searchByWorkflow = {
            passed: workflowSearch.length >= 1,
            detail: `${workflowSearch.length} result(s) by workflow`,
        };
        const assetSearch = engine.searchProductionPlans({ asset: "video" });
        results.searchByAsset = {
            passed: assetSearch.length >= 1,
            detail: `${assetSearch.length} result(s) by asset type`,
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `production-planning-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("production-planning");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        results.recommendationReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: "Production-ready execution plan validated for media generation modules",
        };
        await core.stop("step-5k-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Production-Planning-Report.md"), buildProductionPlanningReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Workflow-Report.md"), buildWorkflowReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Asset-Validation-Report.md"), buildAssetValidationReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-5K-VALIDATION-REPORT.md"), buildProductionPlanningReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
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
function buildProductionPlanningReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# Production Planning Report — Step 5K",
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
        "## Production Plans Prepared",
        "",
        `- Technology: ${tech?.sceneProductionPlans.length ?? 0} scenes on ${tech?.profile.platform ?? "n/a"} (${tech?.scores.productionReadinessScore ?? 0}/100)`,
        `- Fashion: ${fashion?.sceneProductionPlans.length ?? 0} scenes (${fashion?.scores.productionReadinessScore ?? 0}/100)`,
        `- Beauty: ${beauty?.sceneProductionPlans.length ?? 0} scenes (${beauty?.scores.productionReadinessScore ?? 0}/100)`,
        "",
        `Production plans prepared: ${status.productionPlansPrepared}`,
        "",
    ].join("\n");
}
function buildWorkflowReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Workflow Report — Step 5K",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const w = record.workflow;
        lines.push(`## ${record.productId} — ${record.profile.platform}`, "", `- **Pre-Production:** ${w.preProduction}`, `- **Asset Validation:** ${w.assetValidation}`, `- **Scene Preparation:** ${w.scenePreparation}`, `- **Visual Preparation:** ${w.visualPreparation}`, `- **Audio Preparation:** ${w.audioPreparation}`, `- **Rendering Preparation:** ${w.renderingPreparation}`, `- **Export Preparation:** ${w.exportPreparation}`, `- **Delivery Preparation:** ${w.deliveryPreparation}`, "");
    }
    return lines.join("\n");
}
function buildAssetValidationReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Asset Validation Report — Step 5K",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const required = assetAnalyzer.getAllRequiredAssets(record.assets);
        lines.push(`## ${record.productId}`, "", `- **Asset Readiness Score:** ${record.scores.assetReadinessScore}/100`, `- **Required Assets:** ${required.length}`, `- **Videos:** ${record.assets.videos.length}`, `- **Voice-over:** ${record.assets.voiceOver.length}`, `- **Subtitles:** ${record.assets.subtitles.length}`, "", "| Asset ID | Type | Status |", "|----------|------|--------|");
        for (const asset of required.slice(0, 15)) {
            lines.push(`| ${asset.assetId} | ${asset.assetType} | ${asset.status} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Production Readiness Report — Step 5K",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Production | Assets | Workflow | Dependencies | Performance | Production Ready | Validated |",
        "|---------|------------|--------|----------|--------------|-------------|------------------|-----------|",
        ...rows.map((r) => `| ${r.productId} | ${r.scores.productionReadinessScore}/100 | ${r.scores.assetReadinessScore}/100 | ${r.scores.workflowReadinessScore}/100 | ${r.scores.dependencyScore}/100 | ${r.scores.performanceScore}/100 | ${r.productionReady ? "✅" : "❌"} | ${r.validated ? "✅" : "❌"} |`),
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
//# sourceMappingURL=validate-production-planning-engine.js.map