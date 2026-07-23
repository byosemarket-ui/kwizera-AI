import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, RENDER_OUTPUT_PLATFORM_TARGETS, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, StoryboardGenerationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-rendering-preparation-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step8k-kwizera-pro",
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
    productId: "step8k-kwizera-jacket",
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
    productId: "step8k-glow-serum",
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
    const production = await genFoundation.getVideoProductionEngine().generateProductionPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!production.success)
        return undefined;
    return story.record.storyboardId;
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 8K Rendering Preparation Engine Validation");
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
        await core.start("step-8k-validation");
        const initMs = Date.now() - initStart;
        const genFoundation = core.getManager().videoGenerationFoundation;
        const renderingEngine = genFoundation.getRenderingPreparationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: renderingEngine.isInitialized() && renderingEngine.isStartupComplete(),
            detail: renderingEngine.isStartupComplete()
                ? `Rendering Preparation Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = genFoundation.getRegistry().getModule("rendering-planning-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        const techStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm);
        const fashionStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels);
        const beautyStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok);
        results.productionUpstream = {
            passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
            detail: "Production plans prepared for rendering preparation",
        };
        const techRender = await renderingEngine.prepareRenderPlans({ storyboardId: techStoryboardId });
        const fashionRender = await renderingEngine.prepareRenderPlans({ storyboardId: fashionStoryboardId });
        const beautyRender = await renderingEngine.prepareRenderPlans({ storyboardId: beautyStoryboardId });
        results.renderPreparation = {
            passed: techRender.success && fashionRender.success && beautyRender.success,
            detail: `Tech ${techRender.plans?.length ?? 0}, Fashion ${fashionRender.plans?.length ?? 0}, Beauty ${beautyRender.plans?.length ?? 0} render plans`,
        };
        const firstPlan = techRender.plans?.[0];
        results.renderValidation = {
            passed: firstPlan?.renderValidation.allValidated === true &&
                firstPlan?.renderValidation.storyboardValidated === true &&
                firstPlan?.renderValidation.productionPlansValidated === true,
            detail: `Issues: ${firstPlan?.renderValidation.issues.length ?? 0}`,
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
            passed: firstPlan?.timelineValidation.allTimelinesValid === true &&
                (firstPlan?.timelineValidation.renderTimeline.length ?? 0) >= 4 &&
                (firstPlan?.timelineValidation.sceneTimeline.length ?? 0) >= 1,
            detail: `Scenes ${firstPlan?.timelineValidation.sceneTimeline.length}, render steps ${firstPlan?.timelineValidation.renderTimeline.length}`,
        };
        results.renderSettings = {
            passed: Boolean(firstPlan?.renderSettings.resolution &&
                firstPlan?.renderSettings.frameRate &&
                firstPlan?.renderSettings.codec &&
                firstPlan?.renderSettings.bitrate &&
                firstPlan?.renderSettings.pixelFormat &&
                firstPlan?.renderSettings.audioCodec),
            detail: `${firstPlan?.renderSettings.resolution} @ ${firstPlan?.renderSettings.frameRate}`,
        };
        results.outputProfiles = {
            passed: (firstPlan?.outputProfiles.length ?? 0) === RENDER_OUTPUT_PLATFORM_TARGETS.length,
            detail: `${firstPlan?.outputProfiles.length}/${RENDER_OUTPUT_PLATFORM_TARGETS.length} output profiles (incl. Digital Signage)`,
        };
        results.resourcePlanning = {
            passed: Boolean(firstPlan?.resourcePlanning.cpuAllocation &&
                firstPlan?.resourcePlanning.gpuAllocation &&
                firstPlan?.resourcePlanning.ramAllocation &&
                firstPlan?.resourcePlanning.renderQueue),
            detail: `CPU: ${firstPlan?.resourcePlanning.cpuAllocation.slice(0, 30)}...`,
        };
        results.recoveryPlanning = {
            passed: Boolean(firstPlan?.recoveryPlan.checkpointStrategy &&
                firstPlan?.recoveryPlan.resumeRendering &&
                firstPlan?.recoveryPlan.automaticRecovery),
            detail: `Rollback points: ${firstPlan?.recoveryPlan.rollbackPoints.length}`,
        };
        results.renderJobs = {
            passed: (firstPlan?.renderJobs.length ?? 0) >= 1,
            detail: `${firstPlan?.renderJobs.length} render jobs prepared`,
        };
        results.renderScores = {
            passed: (firstPlan?.scores.renderReadinessScore ?? 0) >= 55 &&
                (firstPlan?.scores.assetQualityScore ?? 0) >= 50 &&
                (firstPlan?.scores.timelineIntegrityScore ?? 0) >= 50 &&
                (firstPlan?.scores.platformCompatibilityScore ?? 0) >= 50 &&
                (firstPlan?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Readiness ${firstPlan?.scores.renderReadinessScore}, timeline ${firstPlan?.scores.timelineIntegrityScore}, confidence ${firstPlan?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (firstPlan?.relationships.storyboards.length ?? 0) >= 1 &&
                (firstPlan?.relationships.productionPlans.length ?? 0) >= 1 &&
                (firstPlan?.relationships.scenes.length ?? 0) >= 1,
            detail: `Scenes ${firstPlan?.relationships.scenes.length}, production ${firstPlan?.relationships.productionPlans.length}`,
        };
        results.renderReadiness = {
            passed: techRender.plans?.every((p) => p.renderReady && p.validated) ?? false,
            detail: "All render plans render-ready and validated",
        };
        results.brandConsistency = {
            passed: techRender.plans?.every((p) => p.brandConsistent) ?? false,
            detail: "Brand consistency verified",
        };
        results.recommendationQuality = {
            passed: (firstPlan?.recommendations.length ?? 0) >= 2,
            detail: `${firstPlan?.recommendations.length} recommendations`,
        };
        const noUpstream = await renderingEngine.prepareRenderPlans({ storyboardId: "step8k-nonexistent" });
        results.incompleteRejection = {
            passed: !noUpstream.success,
            detail: noUpstream.message ?? "Rejected without production plans",
        };
        const repaired = await renderingEngine.repairRenderPlans(techStoryboardId);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Render plan repair verified" : "Repair failed",
        };
        const codecSearch = renderingEngine.searchRenderPlans({ codec: "H.265" });
        results.searchByCodec = {
            passed: codecSearch.length >= 1,
            detail: `${codecSearch.length} result(s) by codec`,
        };
        const resolutionSearch = renderingEngine.searchRenderPlans({ resolution: "3840" });
        results.searchByResolution = {
            passed: resolutionSearch.length >= 1,
            detail: `${resolutionSearch.length} result(s) by resolution`,
        };
        const productSearch = renderingEngine.searchRenderPlans({ productId: "step8k-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const keywordSearch = renderingEngine.searchRenderPlans({ keywords: "queue" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstPlan.renderPlanId);
        results.generationAssetRegistration = {
            passed: assetRegistered?.assetType === "timeline",
            detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
        };
        const status = renderingEngine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePreparationMs < 120000,
            detail: `avg preparation ${status.performance.averagePreparationMs}ms, validation ${status.performance.averageValidationMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `rendering-preparation-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashionRender.success && beautyRender.success,
            detail: `Fashion ${fashionRender.plans?.length} plans, Beauty ${beautyRender.plans?.length} plans`,
        };
        await core.stop("step-8k-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Rendering-Preparation-Report.md"), buildMainReport(status, results, storageRoot, allPassed, techRender.plans, fashionRender.plans, beautyRender.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Render-Profile-Report.md"), buildRenderProfileReport(techRender.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Resource-Planning-Report.md"), buildResourceReport(techRender.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Timeline-Integrity-Report.md"), buildTimelineReport(techRender.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Rendering-Readiness-Report.md"), buildReadinessReport(status, techRender.plans, fashionRender.plans, beautyRender.plans), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-8K-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, techRender.plans, fashionRender.plans, beautyRender.plans), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Rendering-Preparation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Render-Profile-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Resource-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Timeline-Integrity-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Rendering-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 8 Step 8K Rendering Preparation Report",
        "",
        `**Phase:** 8 — Video Generation Engine`,
        `**Step:** 8K — AI Rendering Preparation Engine`,
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
        `| **Render Plans Generated** | ${status.renderPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Render Plans",
        "",
        `- Technology: ${tech?.length ?? 0} render plans`,
        `- Fashion: ${fashion?.length ?? 0} render plans`,
        `- Beauty: ${beauty?.length ?? 0} render plans`,
        "",
    ].join("\n");
}
function buildRenderProfileReport(plans) {
    const lines = ["# Render Profile Report — Step 8K", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const p = plan.profile;
        const s = plan.renderSettings;
        lines.push(`## ${p.renderPlanId}`, "", `- Render Plan ID: ${p.renderPlanId}`, `- Project ID: ${p.projectId}`, `- Production ID: ${p.productionId}`, `- Video ID: ${p.videoId}`, `- Platform: ${p.platform}`, `- Render Version: ${p.renderVersion}`, `- Resolution: ${s.resolution}`, `- Codec: ${s.codec}`, `- Output profiles: ${plan.outputProfiles.length}`, "");
    }
    return lines.join("\n");
}
function buildResourceReport(plans) {
    const lines = ["# Resource Planning Report — Step 8K", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const r = plan.resourcePlanning;
        lines.push(`## ${plan.profile.renderPlanId}`, "", `- CPU: ${r.cpuAllocation}`, `- GPU: ${r.gpuAllocation}`, `- RAM: ${r.ramAllocation}`, `- Storage: ${r.storageAllocation}`, `- Cache: ${r.cacheAllocation}`, `- Render queue: ${r.renderQueue}`, `- Parallel prep: ${r.parallelRenderingPreparation}`, "");
    }
    return lines.join("\n");
}
function buildTimelineReport(plans) {
    const lines = ["# Timeline Integrity Report — Step 8K", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const t = plan.timelineValidation;
        lines.push(`## ${plan.profile.renderPlanId}`, "", `- All timelines valid: ${t.allTimelinesValid}`, `- Scene timeline: ${t.sceneTimeline.length} entries`, `- Camera timeline: ${t.cameraTimeline.length} entries`, `- Render timeline: ${t.renderTimeline.join(" → ")}`, `- Integrity score: ${plan.scores.timelineIntegrityScore}`, "");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
    return [
        "# Rendering Readiness Report — Step 8K",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        `**Avg Render Readiness:** ${status.averageRenderReadinessScore}/100`,
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Render plans | ${status.renderPlansGenerated} |`,
        `| Render-ready | ${all.filter((p) => p.renderReady).length}/${all.length} |`,
        `| Validated | ${all.filter((p) => p.validated).length}/${all.length} |`,
        `| Brand consistent | ${all.filter((p) => p.brandConsistent).length}/${all.length} |`,
        "",
        "## Performance",
        "",
        `- Average preparation: ${status.performance.averagePreparationMs}ms`,
        `- Average validation: ${status.performance.averageValidationMs}ms`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-rendering-preparation-engine.js.map