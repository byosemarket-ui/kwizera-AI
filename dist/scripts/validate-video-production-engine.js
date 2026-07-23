import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, ExportFormat, MarketingObjective, PRODUCTION_PLATFORM_TARGETS, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, SUPPORTED_EXPORT_FORMATS, StoryboardGenerationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-video-production-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step8j-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation",
    features: ["AI video generation"],
    specifications: { license: "pro" },
    materials: ["digital-license"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "technology",
    businessType: ProductBusinessType.B2B,
    tags: ["software"],
    keywords: ["kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step8j-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium urban jacket",
    features: ["water-resistant"],
    specifications: { fabric: "cotton-blend" },
    materials: ["cotton"],
    price: 129.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "fashion",
    businessType: ProductBusinessType.D2C,
    tags: ["fashion"],
    keywords: ["jacket"],
};
const SAMPLE_BEAUTY = {
    productId: "step8j-glow-serum",
    productName: "Radiance Vitamin C Serum",
    category: ProductAnalysisCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    description: "Clinical-grade vitamin C serum",
    features: ["vitamin-c"],
    specifications: { volume: "30ml" },
    materials: ["glass-bottle"],
    price: 45.0,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "beauty",
    tags: ["beauty"],
    keywords: ["serum"],
};
async function prepareFullPipeline(piFoundation, genFoundation, sample, objective, platform, genPlatform) {
    await piFoundation.getProductAnalysisEngine().analyzeProduct(sample);
    await piFoundation.getProductUnderstandingEngine().understandProduct({
        productId: sample.productId,
        marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });
    await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: sample.productId });
    await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
        productId: sample.productId,
        marketingObjective: objective,
    });
    await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
        productId: sample.productId,
        platform,
    });
    await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({
        productId: sample.productId,
        includeSocialProof: true,
    });
    const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
        productId: sample.productId,
        platform: genPlatform,
    });
    if (!story.record)
        return undefined;
    const scenes = await genFoundation.getSceneGenerationEngine().generateScenes({
        storyboardId: story.record.storyboardId,
    });
    if (!scenes.success)
        return undefined;
    const camera = await genFoundation.getCameraDirectorEngine().planCamera({
        storyboardId: story.record.storyboardId,
    });
    if (!camera.success)
        return undefined;
    const motion = await genFoundation.getMotionGenerationEngine().generateMotionPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!motion.success)
        return undefined;
    const animation = await genFoundation.getAnimationGenerationEngine().generateAnimationPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!animation.success)
        return undefined;
    const vfx = await genFoundation.getVisualEffectsGenerationEngine().generateVisualEffectPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!vfx.success)
        return undefined;
    const audio = await genFoundation.getAudioSynchronizationEngine().generateAudioSyncPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!audio.success)
        return undefined;
    const marketing = await genFoundation.getMarketingVideoEngine().generateMarketingVideoPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!marketing.success)
        return undefined;
    return story.record.storyboardId;
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 8J Video Production Engine Validation");
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
        await core.start("step-8j-validation");
        const initMs = Date.now() - initStart;
        const genFoundation = core.getManager().videoGenerationFoundation;
        const productionEngine = genFoundation.getVideoProductionEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: productionEngine.isInitialized() && productionEngine.isStartupComplete(),
            detail: productionEngine.isStartupComplete()
                ? `Video Production Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = genFoundation.getRegistry().getModule("video-production-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        const techStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm);
        const fashionStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels);
        const beautyStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok);
        results.marketingUpstream = {
            passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
            detail: "Marketing video plans prepared for production planning",
        };
        const techProduction = await productionEngine.generateProductionPlans({ storyboardId: techStoryboardId });
        const fashionProduction = await productionEngine.generateProductionPlans({ storyboardId: fashionStoryboardId });
        const beautyProduction = await productionEngine.generateProductionPlans({ storyboardId: beautyStoryboardId });
        results.productionPlanning = {
            passed: techProduction.success && fashionProduction.success && beautyProduction.success,
            detail: `Tech ${techProduction.plans?.length ?? 0}, Fashion ${fashionProduction.plans?.length ?? 0}, Beauty ${beautyProduction.plans?.length ?? 0} plans`,
        };
        const firstPlan = techProduction.plans?.[0];
        results.workflowValidation = {
            passed: firstPlan?.workflowValidation.productionWorkflowValidated === true &&
                firstPlan?.workflowValidation.storyboardValidated === true &&
                firstPlan?.workflowValidation.marketingPlansValidated === true,
            detail: `Issues: ${firstPlan?.workflowValidation.issues.length ?? 0}`,
        };
        results.assetValidation = {
            passed: firstPlan?.assetValidation.allAssetsReady === true &&
                Boolean(firstPlan?.assetValidation.voice && firstPlan?.assetValidation.music && firstPlan?.assetValidation.logos),
            detail: `Voice: ${firstPlan?.assetValidation.voice.slice(0, 35)}...`,
        };
        results.dependencyValidation = {
            passed: firstPlan?.dependencyValidation.allDependenciesReady === true &&
                (firstPlan?.dependencyValidation.missingDependencies.length ?? 0) === 0,
            detail: `Dependencies ready: ${firstPlan?.dependencyValidation.allDependenciesReady}`,
        };
        results.timelineValidation = {
            passed: (firstPlan?.productionTimeline.sceneTimeline.length ?? 0) >= 1 &&
                (firstPlan?.productionTimeline.renderingTimeline.length ?? 0) >= 4 &&
                (firstPlan?.productionTimeline.audioTimeline.length ?? 0) >= 1,
            detail: `Scenes ${firstPlan?.productionTimeline.sceneTimeline.length}, render steps ${firstPlan?.productionTimeline.renderingTimeline.length}`,
        };
        results.renderPreparation = {
            passed: Boolean(firstPlan?.renderPreparation.resolution &&
                firstPlan?.renderPreparation.fps &&
                firstPlan?.renderPreparation.codec &&
                firstPlan?.renderPreparation.bitrate),
            detail: `${firstPlan?.renderPreparation.resolution} @ ${firstPlan?.renderPreparation.fps}`,
        };
        results.exportPreparation = {
            passed: (firstPlan?.exportPreparation.formats.length ?? 0) === SUPPORTED_EXPORT_FORMATS.length &&
                firstPlan?.exportPreparation.primaryFormat === ExportFormat.Mp4,
            detail: `${firstPlan?.exportPreparation.formats.length} export formats (MP4, MOV, MKV, WEBM, GIF)`,
        };
        results.deliveryAndRecovery = {
            passed: Boolean(firstPlan?.deliveryInstructions.platformDelivery && firstPlan?.recoveryPlan.checkpointStrategy),
            detail: `Delivery: ${firstPlan?.deliveryInstructions.fileNaming}`,
        };
        results.productionScores = {
            passed: (firstPlan?.scores.productionReadinessScore ?? 0) >= 55 &&
                (firstPlan?.scores.assetReadinessScore ?? 0) >= 50 &&
                (firstPlan?.scores.workflowScore ?? 0) >= 50 &&
                (firstPlan?.scores.timelineScore ?? 0) >= 50 &&
                (firstPlan?.scores.dependencyScore ?? 0) >= 50 &&
                (firstPlan?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Readiness ${firstPlan?.scores.productionReadinessScore}, workflow ${firstPlan?.scores.workflowScore}, confidence ${firstPlan?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (firstPlan?.relationships.storyboards.length ?? 0) >= 1 &&
                (firstPlan?.relationships.marketingPlans.length ?? 0) >= 1 &&
                (firstPlan?.relationships.scenes.length ?? 0) >= 1,
            detail: `Scenes ${firstPlan?.relationships.scenes.length}, marketing ${firstPlan?.relationships.marketingPlans.length}`,
        };
        results.productionReadiness = {
            passed: techProduction.plans?.every((p) => p.productionReady && p.validated) ?? false,
            detail: "All production plans production-ready and validated",
        };
        results.brandConsistency = {
            passed: techProduction.plans?.every((p) => p.brandConsistent) ?? false,
            detail: "Brand consistency verified",
        };
        results.recommendationQuality = {
            passed: (firstPlan?.recommendations.length ?? 0) >= 2,
            detail: `${firstPlan?.recommendations.length} recommendations`,
        };
        const noUpstream = await productionEngine.generateProductionPlans({ storyboardId: "step8j-nonexistent" });
        results.incompleteRejection = {
            passed: !noUpstream.success,
            detail: noUpstream.message ?? "Rejected without marketing plans",
        };
        const repaired = await productionEngine.repairProductionPlans(techStoryboardId);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Production plan repair verified" : "Repair failed",
        };
        const workflowSearch = productionEngine.searchProductionPlans({ workflow: "validate" });
        results.searchByWorkflow = {
            passed: workflowSearch.length >= 1,
            detail: `${workflowSearch.length} result(s) by workflow`,
        };
        const assetSearch = productionEngine.searchProductionPlans({ asset: "voice" });
        results.searchByAsset = {
            passed: assetSearch.length >= 1,
            detail: `${assetSearch.length} result(s) by asset`,
        };
        const productSearch = productionEngine.searchProductionPlans({ productId: "step8j-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstPlan.productionId);
        results.generationAssetRegistration = {
            passed: assetRegistered?.assetType === "export-profile",
            detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
        };
        results.platformOptimization = {
            passed: (firstPlan?.platformOptimizations.length ?? 0) === PRODUCTION_PLATFORM_TARGETS.length,
            detail: `${firstPlan?.platformOptimizations.length}/${PRODUCTION_PLATFORM_TARGETS.length} platform optimizations`,
        };
        const status = productionEngine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, validation ${status.performance.averageValidationMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `video-production-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashionProduction.success && beautyProduction.success,
            detail: `Fashion ${fashionProduction.plans?.length} plans, Beauty ${beautyProduction.plans?.length} plans`,
        };
        await core.stop("step-8j-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Video-Production-Report.md"), buildMainReport(status, results, storageRoot, allPassed, techProduction.plans, fashionProduction.plans, beautyProduction.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Workflow-Report.md"), buildWorkflowReport(techProduction.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Asset-Validation-Report.md"), buildAssetReport(techProduction.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Timeline-Validation-Report.md"), buildTimelineReport(techProduction.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Readiness-Report.md"), buildReadinessReport(status, techProduction.plans, fashionProduction.plans, beautyProduction.plans), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-8J-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, techProduction.plans, fashionProduction.plans, beautyProduction.plans), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Video-Production-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Production-Workflow-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Asset-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Timeline-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Production-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 8 Step 8J Video Production Report",
        "",
        `**Phase:** 8 — Video Generation Engine`,
        `**Step:** 8J — AI Video Production Engine`,
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
        `| **Production Plans Generated** | ${status.productionPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Production Plans",
        "",
        `- Technology: ${tech?.length ?? 0} production plans`,
        `- Fashion: ${fashion?.length ?? 0} production plans`,
        `- Beauty: ${beauty?.length ?? 0} production plans`,
        "",
    ].join("\n");
}
function buildWorkflowReport(plans) {
    const lines = ["# Production Workflow Report — Step 8J", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const w = plan.workflowValidation;
        const pw = plan.productionWorkflow;
        lines.push(`## ${plan.profile.storyboardId}`, "", `- Workflow validated: ${w.productionWorkflowValidated}`, `- Storyboard: ${w.storyboardValidated}`, `- Marketing: ${w.marketingPlansValidated}`, `- Stages: ${pw.workflowStages.join(" → ")}`, `- Gates: ${pw.validationGates.join("; ")}`, "");
    }
    return lines.join("\n");
}
function buildAssetReport(plans) {
    const lines = ["# Asset Validation Report — Step 8J", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const a = plan.assetValidation;
        lines.push(`## ${plan.profile.videoId}`, "", `- Images: ${a.images}`, `- Voice: ${a.voice}`, `- Music: ${a.music}`, `- Brand assets: ${a.brandAssets}`, `- All ready: ${a.allAssetsReady}`, "");
    }
    return lines.join("\n");
}
function buildTimelineReport(plans) {
    const lines = ["# Timeline Validation Report — Step 8J", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const t = plan.productionTimeline;
        lines.push(`## ${plan.profile.storyboardId}`, "", `- Scene timeline: ${t.sceneTimeline.length} entries`, `- Camera timeline: ${t.cameraTimeline.length} entries`, `- Render timeline: ${t.renderingTimeline.join(" → ")}`, "");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
    return [
        "# Production Readiness Report — Step 8J",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        `**Avg Production Readiness:** ${status.averageProductionReadinessScore}/100`,
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Production plans | ${status.productionPlansGenerated} |`,
        `| Production-ready | ${all.filter((p) => p.productionReady).length}/${all.length} |`,
        `| Validated | ${all.filter((p) => p.validated).length}/${all.length} |`,
        `| Brand consistent | ${all.filter((p) => p.brandConsistent).length}/${all.length} |`,
        "",
        "## Performance",
        "",
        `- Average planning: ${status.performance.averagePlanningMs}ms`,
        `- Average validation: ${status.performance.averageValidationMs}ms`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-video-production-engine.js.map