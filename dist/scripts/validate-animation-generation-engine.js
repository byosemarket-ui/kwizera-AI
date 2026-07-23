import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, AnimationPlanType, ANIMATION_PLATFORM_TARGETS, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, StoryboardGenerationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-animation-gen-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step8f-kwizera-pro",
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
    productId: "step8f-kwizera-jacket",
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
    productId: "step8f-glow-serum",
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
    return story.record.storyboardId;
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 8F Animation Generation Engine Validation");
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
        await core.start("step-8f-validation");
        const initMs = Date.now() - initStart;
        const genFoundation = core.getManager().videoGenerationFoundation;
        const animationEngine = genFoundation.getAnimationGenerationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: animationEngine.isInitialized() && animationEngine.isStartupComplete(),
            detail: animationEngine.isStartupComplete()
                ? `Animation Generation Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = genFoundation.getRegistry().getModule("animation-planning-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        const techStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm);
        const fashionStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels);
        const beautyStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok);
        results.motionUpstream = {
            passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
            detail: "Motion plans prepared for animation generation",
        };
        const techAnimation = await animationEngine.generateAnimationPlans({ storyboardId: techStoryboardId });
        const fashionAnimation = await animationEngine.generateAnimationPlans({ storyboardId: fashionStoryboardId });
        const beautyAnimation = await animationEngine.generateAnimationPlans({ storyboardId: beautyStoryboardId });
        results.animationPlanning = {
            passed: techAnimation.success && fashionAnimation.success && beautyAnimation.success,
            detail: `Tech ${techAnimation.plans?.length ?? 0}, Fashion ${fashionAnimation.plans?.length ?? 0}, Beauty ${beautyAnimation.plans?.length ?? 0} plans`,
        };
        const firstPlan = techAnimation.plans?.[0];
        results.characterAnimation = {
            passed: Boolean(firstPlan?.characterAnimation.gesture &&
                firstPlan?.characterAnimation.facialAnimation &&
                firstPlan?.characterAnimation.lipMovementPlan &&
                firstPlan?.characterAnimation.eyeMovement),
            detail: `Gesture: ${firstPlan?.characterAnimation.gesture.slice(0, 40)}...`,
        };
        results.productAnimation = {
            passed: Boolean(firstPlan?.productAnimation.rotation &&
                firstPlan?.productAnimation.reveal &&
                firstPlan?.productAnimation.showcase &&
                firstPlan?.productAnimation.highlight),
            detail: `Showcase: ${firstPlan?.productAnimation.showcase.slice(0, 40)}...`,
        };
        results.objectAnimation = {
            passed: Boolean(firstPlan?.objectAnimation.movement &&
                firstPlan?.objectAnimation.physicsMotion &&
                firstPlan?.objectAnimation.interaction),
            detail: `Movement: ${firstPlan?.objectAnimation.movement.slice(0, 40)}...`,
        };
        results.textAnimation = {
            passed: Boolean(firstPlan?.textAnimation.fade &&
                firstPlan?.textAnimation.slide &&
                firstPlan?.textAnimation.kineticTypography),
            detail: `Kinetic: ${firstPlan?.textAnimation.kineticTypography.slice(0, 40)}...`,
        };
        results.logoAnimation = {
            passed: Boolean(firstPlan?.logoAnimation.logoReveal &&
                firstPlan?.logoAnimation.logoScale &&
                firstPlan?.logoAnimation.logoGlow),
            detail: `Reveal: ${firstPlan?.logoAnimation.logoReveal.slice(0, 40)}...`,
        };
        results.environmentAnimation = {
            passed: Boolean(firstPlan?.environmentAnimation.particles &&
                firstPlan?.environmentAnimation.lightRays),
            detail: `Particles: ${firstPlan?.environmentAnimation.particles.slice(0, 40)}...`,
        };
        results.transitionAnimation = {
            passed: Boolean(firstPlan?.transitionAnimation.fade &&
                firstPlan?.transitionAnimation.dissolve &&
                firstPlan?.transitionAnimation.customTransition),
            detail: `Dissolve: ${firstPlan?.transitionAnimation.dissolve.slice(0, 40)}...`,
        };
        results.animationTimeline = {
            passed: Boolean(firstPlan?.timeline.animationStart &&
                firstPlan?.timeline.animationEnd &&
                firstPlan?.timeline.animationDuration &&
                firstPlan?.timeline.easing &&
                (firstPlan?.timeline.layerPriority.length ?? 0) >= 4),
            detail: `Duration ${firstPlan?.timeline.animationDuration}, layers ${firstPlan?.timeline.layerPriority.length}`,
        };
        results.animationSynchronization = {
            passed: (firstPlan?.synchronization.motionSync.length ?? 0) >= 1 &&
                (firstPlan?.synchronization.cameraSync.length ?? 0) >= 1 &&
                (firstPlan?.synchronization.audioSync.length ?? 0) >= 1,
            detail: `Motion ${firstPlan?.synchronization.motionSync.length}, camera ${firstPlan?.synchronization.cameraSync.length} sync points`,
        };
        results.animationScores = {
            passed: (firstPlan?.scores.animationQualityScore ?? 0) >= 55 &&
                (firstPlan?.scores.smoothnessScore ?? 0) >= 50 &&
                (firstPlan?.scores.visualAppealScore ?? 0) >= 50 &&
                (firstPlan?.scores.synchronizationScore ?? 0) >= 50 &&
                (firstPlan?.scores.productionReadinessScore ?? 0) >= 55 &&
                (firstPlan?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Quality ${firstPlan?.scores.animationQualityScore}, smoothness ${firstPlan?.scores.smoothnessScore}, confidence ${firstPlan?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (firstPlan?.relationships.scenes.length ?? 0) >= 1 &&
                (firstPlan?.relationships.motionPlans.length ?? 0) >= 1 &&
                (firstPlan?.relationships.cameraPlans.length ?? 0) >= 1 &&
                (firstPlan?.relationships.storyboards.length ?? 0) >= 1,
            detail: `Scenes ${firstPlan?.relationships.scenes.length}, motion ${firstPlan?.relationships.motionPlans.length}, camera ${firstPlan?.relationships.cameraPlans.length}`,
        };
        results.productionReadiness = {
            passed: techAnimation.plans?.every((p) => p.productionReady && p.validated) ?? false,
            detail: "All animation plans production-ready and validated",
        };
        results.brandConsistency = {
            passed: techAnimation.plans?.every((p) => p.brandConsistent) ?? false,
            detail: "Brand consistency verified across animation plans",
        };
        results.smoothness = {
            passed: techAnimation.plans?.every((p) => p.smooth) ?? false,
            detail: "Smooth cinematic animation verified",
        };
        const noUpstream = await animationEngine.generateAnimationPlans({ storyboardId: "step8f-nonexistent" });
        results.incompleteRejection = {
            passed: !noUpstream.success,
            detail: noUpstream.message ?? "Rejected without motion plans, camera plans, and scenes",
        };
        const repaired = await animationEngine.repairAnimationPlans(techStoryboardId);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Animation plan repair verified" : "Repair failed",
        };
        const typeSearch = animationEngine.searchAnimationPlans({ planType: AnimationPlanType.Combined });
        results.searchByAnimationType = {
            passed: typeSearch.length >= 1,
            detail: `${typeSearch.length} result(s) by animation type`,
        };
        const storyboardSearch = animationEngine.searchAnimationPlans({ storyboardId: techStoryboardId });
        results.searchByStoryboard = {
            passed: storyboardSearch.length >= (techAnimation.plans?.length ?? 1),
            detail: `${storyboardSearch.length} result(s) by storyboard`,
        };
        const keywordSearch = animationEngine.searchAnimationPlans({ keywords: "product" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstPlan.animationPlanId);
        results.generationAssetRegistration = {
            passed: assetRegistered?.assetType === "template",
            detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
        };
        results.platformOptimization = {
            passed: (firstPlan?.platformOptimizations.length ?? 0) === ANIMATION_PLATFORM_TARGETS.length,
            detail: `${firstPlan?.platformOptimizations.length}/${ANIMATION_PLATFORM_TARGETS.length} platform optimizations`,
        };
        const status = animationEngine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, sync ${status.performance.averageSyncMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `animation-generation-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashionAnimation.success && beautyAnimation.success,
            detail: `Fashion ${fashionAnimation.plans?.length} plans, Beauty ${beautyAnimation.plans?.length} plans`,
        };
        await core.stop("step-8f-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Animation-Report.md"), buildMainReport(status, results, storageRoot, allPassed, techAnimation.plans, fashionAnimation.plans, beautyAnimation.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Character-Animation-Report.md"), buildCharacterReport(techAnimation.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Product-Animation-Report.md"), buildProductReport(techAnimation.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Animation-Synchronization-Report.md"), buildSyncReport(techAnimation.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Animation-Readiness-Report.md"), buildReadinessReport(status, techAnimation.plans, fashionAnimation.plans, beautyAnimation.plans), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-8F-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, techAnimation.plans, fashionAnimation.plans, beautyAnimation.plans), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Animation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Character-Animation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Product-Animation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Animation-Synchronization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Animation-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 8 Step 8F Animation Generation Report",
        "",
        `**Phase:** 8 — Video Generation Engine`,
        `**Step:** 8F — AI Animation Engine`,
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
        `| **Animation Plans Generated** | ${status.animationPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Animation Plans",
        "",
        `- Technology: ${tech?.length ?? 0} animation plans`,
        `- Fashion: ${fashion?.length ?? 0} animation plans`,
        `- Beauty: ${beauty?.length ?? 0} animation plans`,
        "",
    ].join("\n");
}
function buildCharacterReport(plans) {
    const lines = ["# Character Animation Report — Step 8F", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans?.slice(0, 6) ?? []) {
        const c = plan.characterAnimation;
        lines.push(`## ${plan.profile.sceneId}`, "", `- Idle: ${c.idle}`, `- Gesture: ${c.gesture.slice(0, 60)}...`, `- Facial: ${c.facialAnimation}`, `- Lip sync: ${c.lipMovementPlan}`, `- Eye movement: ${c.eyeMovement}`, `- Hand movement: ${c.handMovement.slice(0, 60)}...`, "");
    }
    return lines.join("\n");
}
function buildProductReport(plans) {
    const lines = [
        "# Product Animation Report — Step 8F",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Scene | Rotation | Reveal | Showcase | Highlight |",
        "|-------|----------|--------|----------|-----------|",
    ];
    for (const plan of plans?.slice(0, 8) ?? []) {
        const p = plan.productAnimation;
        lines.push(`| ${plan.profile.sceneId.slice(-24)} | ${p.rotation.slice(0, 20)}... | ${p.reveal.slice(0, 20)}... | ${p.showcase.slice(0, 20)}... | ${p.highlight.slice(0, 20)}... |`);
    }
    lines.push("");
    return lines.join("\n");
}
function buildSyncReport(plans) {
    const lines = ["# Animation Synchronization Report — Step 8F", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans?.slice(0, 6) ?? []) {
        const s = plan.synchronization;
        lines.push(`## ${plan.profile.sceneId}`, "", `- Motion sync: ${s.motionSync.join("; ")}`, `- Camera sync: ${s.cameraSync.slice(0, 2).join("; ")}...`, `- Audio sync: ${s.audioSync.join("; ")}`, `- Transition sync: ${s.transitionSync.join("; ")}`, `- Timeline: ${plan.timeline.animationStart} → ${plan.timeline.animationEnd} (${plan.timeline.animationDuration})`, "");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
    return [
        "# Animation Readiness Report — Step 8F",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        `**Avg Animation Quality:** ${status.averageAnimationQualityScore}/100`,
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Animation plans | ${status.animationPlansGenerated} |`,
        `| Production-ready | ${all.filter((p) => p.productionReady).length}/${all.length} |`,
        `| Validated | ${all.filter((p) => p.validated).length}/${all.length} |`,
        `| Brand consistent | ${all.filter((p) => p.brandConsistent).length}/${all.length} |`,
        `| Smooth | ${all.filter((p) => p.smooth).length}/${all.length} |`,
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
//# sourceMappingURL=validate-animation-generation-engine.js.map