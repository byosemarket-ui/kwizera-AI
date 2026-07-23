import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, StoryboardGenerationPlatform, ALL_STORYBOARD_PLATFORMS, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-story-gen-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step8b-kwizera-pro",
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
    industry: "technology",
    useCase: "creative-production",
    targetCustomer: "creative professionals and marketing teams",
    businessType: ProductBusinessType.B2B,
    tags: ["software", "validation"],
    keywords: ["AI studio", "kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step8b-kwizera-jacket",
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
    industry: "fashion",
    businessType: ProductBusinessType.D2C,
    tags: ["fashion", "validation"],
    keywords: ["jacket", "kwizera"],
};
const SAMPLE_BEAUTY = {
    productId: "step8b-glow-serum",
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
    industry: "beauty",
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
    });
    await foundation.getStoryboardIntelligenceEngine().createStoryboard({
        productId: sample.productId,
        includeSocialProof: true,
    });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 8B Storyboard Generation Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("Project state:", projectStateDir);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({
            storageRootOverride: storageRoot,
            skipPlanningEngine: true,
            skipWorkflowEngine: true,
            skipTaskManager: true,
        });
        const initStart = Date.now();
        await core.start("step-8b-validation");
        const initMs = Date.now() - initStart;
        const genFoundation = core.getManager().videoGenerationFoundation;
        const engine = genFoundation.getStoryGenerationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete()
                ? `Storyboard Generation Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = genFoundation.getRegistry().getModule("story-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
        await prepareFullPipeline(piFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);
        const tech = await engine.generateStoryboard({
            productId: "step8b-kwizera-pro",
            platform: StoryboardGenerationPlatform.YouTubeLongForm,
            generatePlatformVariations: true,
            includeSocialProof: true,
        });
        const fashion = await engine.generateStoryboard({
            productId: "step8b-kwizera-jacket",
            platform: StoryboardGenerationPlatform.InstagramReels,
            generatePlatformVariations: true,
        });
        const beauty = await engine.generateStoryboard({
            productId: "step8b-glow-serum",
            platform: StoryboardGenerationPlatform.TikTok,
            generatePlatformVariations: true,
        });
        results.storyboardGeneration = {
            passed: tech.success && fashion.success && beauty.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Beauty ${beauty.success ? "✓" : "✗"}`,
        };
        results.storyStructure = {
            passed: Boolean(tech.record?.storyStructure.openingHook &&
                tech.record?.storyStructure.problem &&
                tech.record?.storyStructure.solution &&
                tech.record?.storyStructure.callToAction),
            detail: "Full story structure with hook, problem, solution, CTA",
        };
        results.scenePlanning = {
            passed: (tech.record?.scenes.length ?? 0) >= 4 && (fashion.record?.scenes.length ?? 0) >= 4,
            detail: `Tech ${tech.record?.scenes.length} scenes, Fashion ${fashion.record?.scenes.length} scenes`,
        };
        results.shotPlanning = {
            passed: (tech.record?.profile.totalShots ?? 0) >= (tech.record?.scenes.length ?? 0),
            detail: `${tech.record?.profile.totalShots} shots across ${tech.record?.scenes.length} scenes`,
        };
        results.marketingPlanning = {
            passed: Boolean(tech.record?.marketingPlanning.conversionStrategy &&
                tech.record?.marketingPlanning.ctaPlacement &&
                tech.record?.marketingReady),
            detail: `Marketing score ${tech.record?.scores.marketingScore}, marketingReady ${tech.record?.marketingReady}`,
        };
        results.platformVariations = {
            passed: (tech.record?.platformVariations.length ?? 0) === ALL_STORYBOARD_PLATFORMS.length,
            detail: `${tech.record?.platformVariations.length}/${ALL_STORYBOARD_PLATFORMS.length} platform variations`,
        };
        results.storyboardScores = {
            passed: (tech.record?.scores.storyQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.marketingScore ?? 0) >= 50 &&
                (tech.record?.scores.creativeScore ?? 0) >= 50 &&
                (tech.record?.scores.cinematicScore ?? 0) >= 50 &&
                (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Story ${tech.record?.scores.storyQualityScore}, marketing ${tech.record?.scores.marketingScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.products.length ?? 0) >= 1 &&
                (tech.record?.relationships.storyboardIntelligenceIds.length ?? 0) >= 1,
            detail: `Products ${tech.record?.relationships.products.length}, intelligence ${tech.record?.relationships.storyboardIntelligenceIds.length}`,
        };
        results.productionReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
        };
        results.brandConsistency = {
            passed: tech.record?.brandConsistent === true,
            detail: `Brand consistent: ${tech.record?.brandConsistent}`,
        };
        const noPipeline = await engine.generateStoryboard({ productId: "step8b-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream pipeline",
        };
        const promptOnly = await engine.generateStoryboard({
            textPrompt: "Create a compelling product launch storyboard for an innovative AI creative studio",
            brandName: "KWIZERA",
            platform: StoryboardGenerationPlatform.Website,
            generatePlatformVariations: false,
        });
        results.textPromptGeneration = {
            passed: promptOnly.success,
            detail: promptOnly.success ? "Text prompt storyboard generated" : promptOnly.message ?? "Failed",
        };
        const repaired = await engine.repairStoryboard("step8b-kwizera-jacket", StoryboardGenerationPlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Storyboard repair pipeline verified" : "Repair failed",
        };
        const campaignSearch = engine.searchStoryboards({ productId: "step8b-kwizera-pro" });
        results.searchByProduct = {
            passed: campaignSearch.length >= 1,
            detail: `${campaignSearch.length} result(s) by product`,
        };
        const platformSearch = engine.searchStoryboards({ platform: StoryboardGenerationPlatform.TikTok });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const keywordSearch = engine.searchStoryboards({ keywords: "solution" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const assetRegistered = genFoundation.getAssetRegistry().getAsset(tech.record.storyboardId);
        results.generationAssetRegistration = {
            passed: assetRegistered?.assetType === "storyboard",
            detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Asset not found",
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageGenerationMs < 120000,
            detail: `avg generation ${status.performance.averageGenerationMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `story-generation-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.profile.totalScenes} scenes, Beauty ${beauty.record?.profile.totalScenes} scenes`,
        };
        await core.stop("step-8b-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Storyboard-Generation-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Scene-Storyboard-Report.md"), buildSceneReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Shot-Planning-Report.md"), buildShotReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Marketing-Storyboard-Report.md"), buildMarketingReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Storyboard-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-8B-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Storyboard-Generation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Scene-Storyboard-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Shot-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Marketing-Storyboard-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Storyboard-Readiness-Report.md")}`);
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
function buildMainReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# KWIZERA AI STUDIO — Phase 8 Step 8B Storyboard Generation Report",
        "",
        `**Phase:** 8 — Video Generation Engine`,
        `**Step:** 8B — AI Storyboard Generation Engine`,
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        `**Permanent storage:** \`${DEFAULT_STORAGE_ROOT}\``,
        "",
        "## Engine Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        `| **Storyboards Generated** | ${status.storyboardsGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Generated Storyboards",
        "",
        `- Technology: ${tech?.profile.totalScenes ?? 0} scenes, ${tech?.profile.totalShots ?? 0} shots (${tech?.scores.storyQualityScore ?? 0}/100)`,
        `- Fashion: ${fashion?.profile.totalScenes ?? 0} scenes (${fashion?.scores.storyQualityScore ?? 0}/100)`,
        `- Beauty: ${beauty?.profile.totalScenes ?? 0} scenes (${beauty?.scores.storyQualityScore ?? 0}/100)`,
        "",
    ].join("\n");
}
function buildSceneReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Scene Storyboard Report — Step 8B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.profile.productId} — ${record.scenes.length} scenes`, "");
        lines.push("| Order | Purpose | Duration | Mood | Objective |", "|-------|---------|----------|------|-----------|");
        for (const scene of record.scenes) {
            lines.push(`| ${scene.sceneOrder} | ${scene.scenePurpose} | ${scene.sceneDuration} | ${scene.sceneMood} | ${scene.sceneObjective.slice(0, 40)}... |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildShotReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Shot Planning Report — Step 8B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.profile.productId} — ${record.profile.totalShots} shots`, "");
        for (const scene of record.scenes) {
            lines.push(`### Scene ${scene.sceneOrder}: ${scene.scenePurpose}`, "");
            lines.push("| Shot | Type | Angle | Movement | Duration |", "|------|------|-------|----------|----------|");
            for (const shot of scene.shots) {
                lines.push(`| ${shot.shotOrder} | ${shot.shotType} | ${shot.cameraAngle} | ${shot.cameraMovement} | ${shot.duration} |`);
            }
            lines.push("");
        }
    }
    return lines.join("\n");
}
function buildMarketingReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Marketing Storyboard Report — Step 8B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Marketing Score | Product Reveal | CTA | Conversion Strategy | Marketing Ready |",
        "|---------|-----------------|----------------|-----|---------------------|-----------------|",
    ];
    for (const record of rows) {
        lines.push(`| ${record.profile.productId} | ${record.scores.marketingScore}/100 | ${record.marketingPlanning.productReveal.slice(0, 30)}... | ${record.marketingPlanning.ctaPlacement.slice(0, 25)}... | ${record.marketingPlanning.conversionStrategy.slice(0, 30)}... | ${record.marketingReady ? "✅" : "❌"} |`);
    }
    lines.push("", "## Viewer Journey", "");
    if (tech) {
        lines.push(`- Attention: ${tech.viewerJourney.attentionPhase.slice(0, 60)}...`, `- Interest: ${tech.viewerJourney.interestPhase.slice(0, 60)}...`, `- Desire: ${tech.viewerJourney.desirePhase.slice(0, 60)}...`, `- Action: ${tech.viewerJourney.actionPhase.slice(0, 60)}...`);
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Storyboard Readiness Report — Step 8B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Story | Marketing | Creative | Cinematic | Production | Confidence | Ready |",
        "|---------|-------|-----------|----------|-----------|------------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.productId} | ${r.scores.storyQualityScore} | ${r.scores.marketingScore} | ${r.scores.creativeScore} | ${r.scores.cinematicScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average generation: ${status.performance.averageGenerationMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- Platform variations: ${status.platformVariationStatus}`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-story-generation-engine.js.map