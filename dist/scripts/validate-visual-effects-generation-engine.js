import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, VisualEffectPlanType, VFX_PLATFORM_TARGETS, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, StoryboardGenerationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-vfx-gen-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step8g-kwizera-pro",
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
    productId: "step8g-kwizera-jacket",
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
    productId: "step8g-glow-serum",
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
    return story.record.storyboardId;
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 8G Visual Effects Generation Engine Validation");
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
        await core.start("step-8g-validation");
        const initMs = Date.now() - initStart;
        const genFoundation = core.getManager().videoGenerationFoundation;
        const vfxEngine = genFoundation.getVisualEffectsGenerationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: vfxEngine.isInitialized() && vfxEngine.isStartupComplete(),
            detail: vfxEngine.isStartupComplete()
                ? `Visual Effects Generation Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = genFoundation.getRegistry().getModule("visual-effects-planning-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        const techStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm);
        const fashionStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels);
        const beautyStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok);
        results.animationUpstream = {
            passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
            detail: "Animation plans prepared for visual effects generation",
        };
        const techVfx = await vfxEngine.generateVisualEffectPlans({ storyboardId: techStoryboardId });
        const fashionVfx = await vfxEngine.generateVisualEffectPlans({ storyboardId: fashionStoryboardId });
        const beautyVfx = await vfxEngine.generateVisualEffectPlans({ storyboardId: beautyStoryboardId });
        results.visualEffectsPlanning = {
            passed: techVfx.success && fashionVfx.success && beautyVfx.success,
            detail: `Tech ${techVfx.plans?.length ?? 0}, Fashion ${fashionVfx.plans?.length ?? 0}, Beauty ${beautyVfx.plans?.length ?? 0} plans`,
        };
        const firstPlan = techVfx.plans?.[0];
        results.lightingEffects = {
            passed: Boolean(firstPlan?.lightingEffects.glow &&
                firstPlan?.lightingEffects.lightRays &&
                firstPlan?.lightingEffects.bloom &&
                firstPlan?.lightingEffects.volumetricLighting),
            detail: `Glow: ${firstPlan?.lightingEffects.glow.slice(0, 40)}...`,
        };
        results.atmosphericEffects = {
            passed: Boolean(firstPlan?.atmosphericEffects.particles &&
                firstPlan?.atmosphericEffects.fog &&
                firstPlan?.atmosphericEffects.dust),
            detail: `Particles: ${firstPlan?.atmosphericEffects.particles.slice(0, 40)}...`,
        };
        results.productEffects = {
            passed: Boolean(firstPlan?.productEffects.productGlow &&
                firstPlan?.productEffects.productHighlight &&
                firstPlan?.productEffects.shine),
            detail: `Glow: ${firstPlan?.productEffects.productGlow.slice(0, 40)}...`,
        };
        results.environmentEffects = {
            passed: Boolean(firstPlan?.environmentEffects.ambientMotion &&
                firstPlan?.environmentEffects.wind),
            detail: `Ambient: ${firstPlan?.environmentEffects.ambientMotion.slice(0, 40)}...`,
        };
        results.transitionEffects = {
            passed: Boolean(firstPlan?.transitionEffects.fade &&
                firstPlan?.transitionEffects.dissolve &&
                firstPlan?.transitionEffects.motionBlur),
            detail: `Dissolve: ${firstPlan?.transitionEffects.dissolve.slice(0, 40)}...`,
        };
        results.textGraphicEffects = {
            passed: Boolean(firstPlan?.textGraphicEffects.textGlow &&
                firstPlan?.textGraphicEffects.textReveal &&
                firstPlan?.textGraphicEffects.logoEffects),
            detail: `Text reveal: ${firstPlan?.textGraphicEffects.textReveal.slice(0, 40)}...`,
        };
        results.colorEffects = {
            passed: Boolean(firstPlan?.colorEffects.colorGrading &&
                firstPlan?.colorEffects.cinematicLutPlanning &&
                firstPlan?.colorEffects.hdrPreparation &&
                firstPlan?.colorEffects.toneMapping),
            detail: `Grading: ${firstPlan?.colorEffects.colorGrading.slice(0, 40)}...`,
        };
        results.cinematicEffects = {
            passed: Boolean(firstPlan?.cinematicEffects.depthOfField &&
                firstPlan?.cinematicEffects.vignette),
            detail: `DOF: ${firstPlan?.cinematicEffects.depthOfField.slice(0, 40)}...`,
        };
        results.effectSynchronization = {
            passed: (firstPlan?.synchronization.motionSync.length ?? 0) >= 1 &&
                (firstPlan?.synchronization.cameraSync.length ?? 0) >= 1 &&
                (firstPlan?.synchronization.animationSync.length ?? 0) >= 1 &&
                (firstPlan?.synchronization.audioSync.length ?? 0) >= 1,
            detail: `Motion ${firstPlan?.synchronization.motionSync.length}, animation ${firstPlan?.synchronization.animationSync.length} sync points`,
        };
        results.visualEffectsScores = {
            passed: (firstPlan?.scores.visualEffectsScore ?? 0) >= 55 &&
                (firstPlan?.scores.cinematicScore ?? 0) >= 50 &&
                (firstPlan?.scores.synchronizationScore ?? 0) >= 50 &&
                (firstPlan?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (firstPlan?.scores.productionReadinessScore ?? 0) >= 55 &&
                (firstPlan?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `VFX ${firstPlan?.scores.visualEffectsScore}, cinematic ${firstPlan?.scores.cinematicScore}, confidence ${firstPlan?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (firstPlan?.relationships.scenes.length ?? 0) >= 1 &&
                (firstPlan?.relationships.animationPlans.length ?? 0) >= 1 &&
                (firstPlan?.relationships.motionPlans.length ?? 0) >= 1 &&
                (firstPlan?.relationships.cameraPlans.length ?? 0) >= 1,
            detail: `Scenes ${firstPlan?.relationships.scenes.length}, animation ${firstPlan?.relationships.animationPlans.length}`,
        };
        results.productionReadiness = {
            passed: techVfx.plans?.every((p) => p.productionReady && p.validated) ?? false,
            detail: "All visual effect plans production-ready and validated",
        };
        results.brandConsistency = {
            passed: techVfx.plans?.every((p) => p.brandConsistent) ?? false,
            detail: "Brand consistency verified across visual effect plans",
        };
        results.cinematicConsistency = {
            passed: techVfx.plans?.every((p) => p.cinematicallyConsistent) ?? false,
            detail: "Cinematic consistency verified",
        };
        const noUpstream = await vfxEngine.generateVisualEffectPlans({ storyboardId: "step8g-nonexistent" });
        results.incompleteRejection = {
            passed: !noUpstream.success,
            detail: noUpstream.message ?? "Rejected without animation plans and upstream assets",
        };
        const repaired = await vfxEngine.repairVisualEffectPlans(techStoryboardId);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Visual effect plan repair verified" : "Repair failed",
        };
        const typeSearch = vfxEngine.searchVisualEffectPlans({ planType: VisualEffectPlanType.Combined });
        results.searchByEffectType = {
            passed: typeSearch.length >= 1,
            detail: `${typeSearch.length} result(s) by effect type`,
        };
        const storyboardSearch = vfxEngine.searchVisualEffectPlans({ storyboardId: techStoryboardId });
        results.searchByStoryboard = {
            passed: storyboardSearch.length >= (techVfx.plans?.length ?? 1),
            detail: `${storyboardSearch.length} result(s) by storyboard`,
        };
        const keywordSearch = vfxEngine.searchVisualEffectPlans({ keywords: "product" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstPlan.visualEffectPlanId);
        results.generationAssetRegistration = {
            passed: assetRegistered?.assetType === "effect",
            detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
        };
        results.platformOptimization = {
            passed: (firstPlan?.platformOptimizations.length ?? 0) === VFX_PLATFORM_TARGETS.length,
            detail: `${firstPlan?.platformOptimizations.length}/${VFX_PLATFORM_TARGETS.length} platform optimizations`,
        };
        const status = vfxEngine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, sync ${status.performance.averageSyncMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `visual-effects-generation-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashionVfx.success && beautyVfx.success,
            detail: `Fashion ${fashionVfx.plans?.length} plans, Beauty ${beautyVfx.plans?.length} plans`,
        };
        await core.stop("step-8g-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Visual-Effects-Report.md"), buildMainReport(status, results, storageRoot, allPassed, techVfx.plans, fashionVfx.plans, beautyVfx.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Lighting-Effects-Report.md"), buildLightingReport(techVfx.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Atmospheric-Effects-Report.md"), buildAtmosphericReport(techVfx.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Product-Effects-Report.md"), buildProductReport(techVfx.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Visual-Effects-Readiness-Report.md"), buildReadinessReport(status, techVfx.plans, fashionVfx.plans, beautyVfx.plans), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-8G-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, techVfx.plans, fashionVfx.plans, beautyVfx.plans), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Visual-Effects-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Lighting-Effects-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Atmospheric-Effects-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Product-Effects-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Visual-Effects-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 8 Step 8G Visual Effects Report",
        "",
        `**Phase:** 8 — Video Generation Engine`,
        `**Step:** 8G — AI Visual Effects Engine`,
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
        `| **Visual Effect Plans Generated** | ${status.visualEffectPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Visual Effect Plans",
        "",
        `- Technology: ${tech?.length ?? 0} visual effect plans`,
        `- Fashion: ${fashion?.length ?? 0} visual effect plans`,
        `- Beauty: ${beauty?.length ?? 0} visual effect plans`,
        "",
    ].join("\n");
}
function buildLightingReport(plans) {
    const lines = ["# Lighting Effects Report — Step 8G", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans?.slice(0, 6) ?? []) {
        const l = plan.lightingEffects;
        lines.push(`## ${plan.profile.sceneId}`, "", `- Glow: ${l.glow}`, `- Light rays: ${l.lightRays}`, `- Bloom: ${l.bloom}`, `- Rim light: ${l.rimLight}`, `- Volumetric: ${l.volumetricLighting}`, "");
    }
    return lines.join("\n");
}
function buildAtmosphericReport(plans) {
    const lines = ["# Atmospheric Effects Report — Step 8G", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans?.slice(0, 6) ?? []) {
        const a = plan.atmosphericEffects;
        lines.push(`## ${plan.profile.sceneId}`, "", `- Fog: ${a.fog}`, `- Particles: ${a.particles}`, `- Dust: ${a.dust}`, `- Smoke: ${a.smoke}`, "");
    }
    return lines.join("\n");
}
function buildProductReport(plans) {
    const lines = [
        "# Product Effects Report — Step 8G",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Scene | Product Glow | Highlight | Shine | Premium Reveal |",
        "|-------|--------------|-----------|-------|----------------|",
    ];
    for (const plan of plans?.slice(0, 8) ?? []) {
        const p = plan.productEffects;
        lines.push(`| ${plan.profile.sceneId.slice(-24)} | ${p.productGlow.slice(0, 20)}... | ${p.productHighlight.slice(0, 20)}... | ${p.shine.slice(0, 20)}... | ${p.premiumReveal.slice(0, 20)}... |`);
    }
    lines.push("");
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
    return [
        "# Visual Effects Readiness Report — Step 8G",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        `**Avg Visual Effects Score:** ${status.averageVisualEffectsScore}/100`,
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Visual effect plans | ${status.visualEffectPlansGenerated} |`,
        `| Production-ready | ${all.filter((p) => p.productionReady).length}/${all.length} |`,
        `| Validated | ${all.filter((p) => p.validated).length}/${all.length} |`,
        `| Brand consistent | ${all.filter((p) => p.brandConsistent).length}/${all.length} |`,
        `| Cinematically consistent | ${all.filter((p) => p.cinematicallyConsistent).length}/${all.length} |`,
        "",
        "## Performance",
        "",
        `- Average planning: ${status.performance.averagePlanningMs}ms`,
        `- Average sync: ${status.performance.averageSyncMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-visual-effects-generation-engine.js.map