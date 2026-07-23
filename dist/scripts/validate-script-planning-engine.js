import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-script-planning-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step5h-kwizera-pro",
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
    productId: "step5h-kwizera-jacket",
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
    productId: "step5h-glow-serum",
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
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 5H Script Planning Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-5h-validation");
        const foundation = core.getManager().productIntelligenceFoundation;
        const engine = foundation.getScriptPlanningEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Script Planning Engine operational",
        };
        await prepareFullPipeline(foundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        const planStart = Date.now();
        const tech = await engine.createScriptPlan({ productId: "step5h-kwizera-pro" });
        const planMs = Date.now() - planStart;
        results.scriptPlanCreation = {
            passed: tech.success && Boolean(tech.record),
            detail: `Technology script plan created in ${planMs}ms, score ${tech.record?.scores.scriptPlanningScore}`,
        };
        const storyboard = foundation
            .getStoryboardIntelligenceEngine()
            .getStoryboardsByProduct("step5h-kwizera-pro")[0];
        results.scriptProfile = {
            passed: Boolean(tech.record?.profile.scriptPlanId) &&
                Boolean(tech.record?.profile.storyboardId) &&
                Boolean(tech.record?.profile.estimatedDuration),
            detail: `Plan ${tech.record?.profile.scriptPlanId}, v${tech.record?.profile.scriptVersion}`,
        };
        results.sceneScriptPlanning = {
            passed: (tech.record?.scenePlans.length ?? 0) >= 5 &&
                tech.record?.scenePlans.length === storyboard?.scenes.length &&
                tech.record?.scenePlans.every((s) => s.plannedNarration.startsWith("Plan narration")) === true,
            detail: `${tech.record?.scenePlans.length} scene plans aligned with storyboard`,
        };
        results.scriptStructure = {
            passed: Boolean(tech.record?.scriptStructure.hook) &&
                Boolean(tech.record?.scriptStructure.callToAction) &&
                Boolean(tech.record?.scriptStructure.closing),
            detail: "Opening through closing script structure prepared",
        };
        results.narrationPlanning = {
            passed: Boolean(tech.record?.voicePreparation.voiceStyle) &&
                Boolean(tech.record?.voicePreparation.narrationStyle) &&
                (tech.record?.voicePreparation.pauseLocations.length ?? 0) >= 1,
            detail: `Voice: ${tech.record?.voicePreparation.voiceStyle}, speed ${tech.record?.voicePreparation.speakingSpeed}`,
        };
        results.subtitlePlanning = {
            passed: Object.keys(tech.record?.subtitlePreparation.subtitleTiming ?? {}).length >= 5 &&
                (tech.record?.subtitlePreparation.synchronizationRules.length ?? 0) >= 3,
            detail: `${Object.keys(tech.record?.subtitlePreparation.subtitleTiming ?? {}).length} subtitle timings, line validation active`,
        };
        results.timingPlanning = {
            passed: tech.record?.scenePlans.every((s) => Boolean(s.estimatedReadingTime) && Boolean(s.estimatedDisplayTime)) ===
                true,
            detail: "Reading and display timing planned per scene",
        };
        results.platformAdaptation = {
            passed: Boolean(tech.record?.platformRules.platform) &&
                (tech.record?.platformRules.maxWordsPerScene ?? 0) > 0 &&
                Boolean(tech.record?.platformRules.ctaPlacementRule),
            detail: `${tech.record?.platformRules.platform} — max ${tech.record?.platformRules.maxWordsPerScene} words/scene`,
        };
        await prepareFullPipeline(foundation, SAMPLE_FASHION, MarketingObjective.BrandAwareness, CreativePlatform.InstagramReels);
        await prepareFullPipeline(foundation, SAMPLE_BEAUTY, MarketingObjective.SalesGrowth, CreativePlatform.TikTok);
        const fashion = await engine.createScriptPlan({ productId: "step5h-kwizera-jacket" });
        const beauty = await engine.createScriptPlan({ productId: "step5h-glow-serum", language: "en" });
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.scenePlans.length} scenes, Beauty ${beauty.record?.scenePlans.length} scenes`,
        };
        results.scriptScores = {
            passed: (tech.record?.scores.scriptPlanningScore ?? 0) >= 55 &&
                (tech.record?.scores.storytellingScore ?? 0) >= 50 &&
                (tech.record?.scores.marketingScore ?? 0) >= 50 &&
                (tech.record?.scores.readabilityScore ?? 0) >= 50 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Planning ${tech.record?.scores.scriptPlanningScore}, readability ${tech.record?.scores.readabilityScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationshipDetection = {
            passed: (tech.record?.relationships.storyboards.length ?? 0) >= 1 &&
                (tech.record?.relationships.products.length ?? 0) >= 1 &&
                (tech.record?.relationships.creativeDirections.length ?? 0) >= 1 &&
                (tech.record?.relationships.marketingStrategies.length ?? 0) >= 1,
            detail: `Storyboards ${tech.record?.relationships.storyboards.length}, audio ${tech.record?.relationships.audioPlans.length}, production ${tech.record?.relationships.productionPlans.length}`,
        };
        const noPipeline = await engine.createScriptPlan({ productId: "step5h-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream pipeline",
        };
        const repaired = await engine.repairScriptPlan("step5h-kwizera-jacket", CreativePlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Script plan repair pipeline verified" : "Repair failed",
        };
        const storyboardSearch = engine.searchScriptPlans({ storyboardId: tech.record?.storyboardId });
        results.searchByStoryboard = {
            passed: storyboardSearch.length >= 1,
            detail: `${storyboardSearch.length} result(s) by storyboard`,
        };
        const platformSearch = engine.searchScriptPlans({ platform: CreativePlatform.YouTube });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const brandSearch = engine.searchScriptPlans({ brand: "KWIZERA" });
        results.searchByBrand = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const goalSearch = engine.searchScriptPlans({ campaignGoal: MarketingObjective.ProductLaunch });
        results.searchByCampaignGoal = {
            passed: goalSearch.length >= 1,
            detail: `${goalSearch.length} result(s) by campaign goal`,
        };
        const languageSearch = engine.searchScriptPlans({ language: "en" });
        results.searchByLanguage = {
            passed: languageSearch.length >= 1,
            detail: `${languageSearch.length} result(s) by language`,
        };
        const audienceSearch = engine.searchScriptPlans({ audience: "creative" });
        results.searchByAudience = {
            passed: audienceSearch.length >= 1,
            detail: `${audienceSearch.length} result(s) by audience`,
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `script-planning-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("script-planning");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        results.recommendationReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: "Production-ready script plan validated for script generation modules",
        };
        await core.stop("step-5h-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Script-Planning-Report.md"), buildScriptPlanningReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Narration-Planning-Report.md"), buildNarrationPlanningReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Subtitle-Planning-Report.md"), buildSubtitlePlanningReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Script-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-5H-VALIDATION-REPORT.md"), buildScriptPlanningReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
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
function buildScriptPlanningReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# Script Planning Report — Step 5H",
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
        "## Script Plans Prepared",
        "",
        `- Technology: ${tech?.scenePlans.length ?? 0} scene plans on ${tech?.profile.platform ?? "n/a"} (${tech?.scores.scriptPlanningScore ?? 0}/100)`,
        `- Fashion: ${fashion?.scenePlans.length ?? 0} scene plans (${fashion?.scores.scriptPlanningScore ?? 0}/100)`,
        `- Beauty: ${beauty?.scenePlans.length ?? 0} scene plans (${beauty?.scores.scriptPlanningScore ?? 0}/100)`,
        "",
        `Script plans prepared: ${status.scriptPlansPrepared}`,
        "",
    ].join("\n");
}
function buildNarrationPlanningReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Narration Planning Report — Step 5H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const v = record.voicePreparation;
        lines.push(`## ${record.productId} — ${record.profile.platform}`, "", `- **Voice Style:** ${v.voiceStyle}`, `- **Narration Style:** ${v.narrationStyle}`, `- **Speaking Speed:** ${v.speakingSpeed}`, `- **Emotional Tone:** ${v.emotionalTone}`, `- **Pause Locations:** ${v.pauseLocations.join("; ")}`, `- **Emphasis Points:** ${v.emphasisPoints.join("; ")}`, "", "| # | Purpose | Planned Narration | Reading Time |", "|---|---------|-------------------|--------------|");
        for (const scene of record.scenePlans) {
            lines.push(`| ${scene.sceneNumber} | ${scene.scenePurpose} | ${scene.plannedNarration.slice(0, 50)}... | ${scene.estimatedReadingTime} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildSubtitlePlanningReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Subtitle Planning Report — Step 5H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const s = record.subtitlePreparation;
        lines.push(`## ${record.productId}`, "", `- **Position:** ${s.subtitlePosition}`, `- **Line Validation:** ${s.lineLengthValidation}`, `- **Sync Rules:** ${s.synchronizationRules.join("; ")}`, "", "| # | Planned Subtitle | Display Time | Reading Duration |", "|---|------------------|--------------|------------------|");
        for (const scene of record.scenePlans) {
            lines.push(`| ${scene.sceneNumber} | ${scene.plannedSubtitle.slice(0, 40)}... | ${scene.estimatedDisplayTime} | ${s.readingDuration[scene.sceneNumber] ?? scene.estimatedReadingTime} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Script Readiness Report — Step 5H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Planning | Storytelling | Marketing | Readability | Brand | Production Ready | Validated |",
        "|---------|----------|--------------|-----------|-------------|-------|------------------|-----------|",
        ...rows.map((r) => `| ${r.productId} | ${r.scores.scriptPlanningScore}/100 | ${r.scores.storytellingScore}/100 | ${r.scores.marketingScore}/100 | ${r.scores.readabilityScore}/100 | ${r.scores.brandConsistencyScore}/100 | ${r.productionReady ? "✅" : "❌"} | ${r.validated ? "✅" : "❌"} |`),
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
//# sourceMappingURL=validate-script-planning-engine.js.map