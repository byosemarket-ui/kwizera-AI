import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, MARKETING_VIDEO_PLATFORM_TARGETS, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, StoryboardGenerationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-marketing-video-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step8i-kwizera-pro",
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
    productId: "step8i-kwizera-jacket",
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
    productId: "step8i-glow-serum",
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
    return story.record.storyboardId;
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 8I Marketing Video Engine Validation");
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
        await core.start("step-8i-validation");
        const initMs = Date.now() - initStart;
        const genFoundation = core.getManager().videoGenerationFoundation;
        const marketingEngine = genFoundation.getMarketingVideoEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: marketingEngine.isInitialized() && marketingEngine.isStartupComplete(),
            detail: marketingEngine.isStartupComplete()
                ? `Marketing Video Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = genFoundation.getRegistry().getModule("marketing-video-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        const techStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm);
        const fashionStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels);
        const beautyStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok);
        results.audioUpstream = {
            passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
            detail: "Audio sync plans prepared for marketing video generation",
        };
        const techMarketing = await marketingEngine.generateMarketingVideoPlans({ storyboardId: techStoryboardId });
        const fashionMarketing = await marketingEngine.generateMarketingVideoPlans({ storyboardId: fashionStoryboardId });
        const beautyMarketing = await marketingEngine.generateMarketingVideoPlans({ storyboardId: beautyStoryboardId });
        results.marketingVideoPlanning = {
            passed: techMarketing.success && fashionMarketing.success && beautyMarketing.success,
            detail: `Tech ${techMarketing.plans?.length ?? 0}, Fashion ${fashionMarketing.plans?.length ?? 0}, Beauty ${beautyMarketing.plans?.length ?? 0} plans`,
        };
        const firstPlan = techMarketing.plans?.[0];
        results.marketingStrategy = {
            passed: Boolean(firstPlan?.marketingStrategy.campaignObjective &&
                firstPlan?.marketingStrategy.valueProposition &&
                firstPlan?.marketingStrategy.brandPositioning &&
                (firstPlan?.marketingStrategy.productBenefits.length ?? 0) >= 1),
            detail: `Goal: ${firstPlan?.marketingStrategy.marketingGoal.slice(0, 40)}...`,
        };
        results.hookOptimization = {
            passed: Boolean(firstPlan?.hookOptimization.first3SecondsStrategy &&
                firstPlan?.hookOptimization.attentionHook &&
                firstPlan?.hookOptimization.visualHook &&
                firstPlan?.hookOptimization.audioHook),
            detail: `Hook: ${firstPlan?.hookOptimization.first3SecondsStrategy.slice(0, 40)}...`,
        };
        results.productPresentation = {
            passed: Boolean(firstPlan?.productPresentation.productRevealTiming &&
                firstPlan?.productPresentation.productHighlight &&
                firstPlan?.productPresentation.benefitPresentation),
            detail: `Reveal: ${firstPlan?.productPresentation.productRevealTiming.slice(0, 40)}...`,
        };
        results.ctaPlanning = {
            passed: Boolean(firstPlan?.callToAction.ctaTiming &&
                firstPlan?.callToAction.ctaPosition &&
                firstPlan?.callToAction.ctaStyle &&
                firstPlan?.callToAction.ctaPriority),
            detail: `CTA: ${firstPlan?.callToAction.ctaTiming.slice(0, 40)}...`,
        };
        results.engagementOptimization = {
            passed: Boolean(firstPlan?.engagementOptimization.viewerRetentionStrategy &&
                (firstPlan?.engagementOptimization.curiosityTriggers.length ?? 0) >= 2 &&
                firstPlan?.engagementOptimization.shareability),
            detail: `Retention: ${firstPlan?.engagementOptimization.viewerRetentionStrategy.slice(0, 40)}...`,
        };
        results.conversionOptimization = {
            passed: Boolean(firstPlan?.conversionOptimization.purchaseMotivation &&
                firstPlan?.conversionOptimization.trustBuilding &&
                firstPlan?.conversionOptimization.conversionPath),
            detail: `Path: ${firstPlan?.conversionOptimization.conversionPath.slice(0, 40)}...`,
        };
        results.abTestPreparation = {
            passed: (firstPlan?.abTestPreparation.hookVariants.length ?? 0) >= 2 &&
                (firstPlan?.abTestPreparation.ctaVariants.length ?? 0) >= 2,
            detail: `${firstPlan?.abTestPreparation.hookVariants.length} hooks, ${firstPlan?.abTestPreparation.ctaVariants.length} CTAs`,
        };
        results.marketingScores = {
            passed: (firstPlan?.scores.marketingQualityScore ?? 0) >= 55 &&
                (firstPlan?.scores.engagementScore ?? 0) >= 50 &&
                (firstPlan?.scores.conversionScore ?? 0) >= 50 &&
                (firstPlan?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (firstPlan?.scores.platformReadinessScore ?? 0) >= 55 &&
                (firstPlan?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Quality ${firstPlan?.scores.marketingQualityScore}, engagement ${firstPlan?.scores.engagementScore}, confidence ${firstPlan?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (firstPlan?.relationships.storyboards.length ?? 0) >= 1 &&
                (firstPlan?.relationships.audioPlans.length ?? 0) >= 1 &&
                (firstPlan?.relationships.scenes.length ?? 0) >= 1,
            detail: `Storyboards ${firstPlan?.relationships.storyboards.length}, audio ${firstPlan?.relationships.audioPlans.length}, scenes ${firstPlan?.relationships.scenes.length}`,
        };
        results.productionReadiness = {
            passed: techMarketing.plans?.every((p) => p.productionReady && p.validated) ?? false,
            detail: "All marketing video plans production-ready and validated",
        };
        results.marketingReadiness = {
            passed: techMarketing.plans?.every((p) => p.marketingReady) ?? false,
            detail: "Marketing-ready status verified",
        };
        results.brandConsistency = {
            passed: techMarketing.plans?.every((p) => p.brandConsistent) ?? false,
            detail: "Brand consistency verified across marketing plans",
        };
        results.recommendationQuality = {
            passed: (firstPlan?.recommendations.length ?? 0) >= 2,
            detail: `${firstPlan?.recommendations.length} recommendations generated`,
        };
        const noUpstream = await marketingEngine.generateMarketingVideoPlans({ storyboardId: "step8i-nonexistent" });
        results.incompleteRejection = {
            passed: !noUpstream.success,
            detail: noUpstream.message ?? "Rejected without audio sync and upstream assets",
        };
        const repaired = await marketingEngine.repairMarketingVideoPlans(techStoryboardId);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Marketing video plan repair verified" : "Repair failed",
        };
        const campaignSearch = marketingEngine.searchMarketingVideoPlans({ campaignId: firstPlan.profile.campaignId });
        results.searchByCampaign = {
            passed: campaignSearch.length >= 1,
            detail: `${campaignSearch.length} result(s) by campaign`,
        };
        const productSearch = marketingEngine.searchMarketingVideoPlans({ productId: "step8i-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const keywordSearch = marketingEngine.searchMarketingVideoPlans({ keywords: "product" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstPlan.marketingVideoId);
        results.generationAssetRegistration = {
            passed: assetRegistered?.assetType === "timeline",
            detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
        };
        results.platformOptimization = {
            passed: (firstPlan?.platformOptimizations.length ?? 0) === MARKETING_VIDEO_PLATFORM_TARGETS.length,
            detail: `${firstPlan?.platformOptimizations.length}/${MARKETING_VIDEO_PLATFORM_TARGETS.length} platform optimizations`,
        };
        const status = marketingEngine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `marketing-video-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashionMarketing.success && beautyMarketing.success,
            detail: `Fashion ${fashionMarketing.plans?.length} plans, Beauty ${beautyMarketing.plans?.length} plans`,
        };
        await core.stop("step-8i-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Marketing-Video-Report.md"), buildMainReport(status, results, storageRoot, allPassed, techMarketing.plans, fashionMarketing.plans, beautyMarketing.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Marketing-Strategy-Report.md"), buildStrategyReport(techMarketing.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "CTA-Planning-Report.md"), buildCtaReport(techMarketing.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Engagement-Optimization-Report.md"), buildEngagementReport(techMarketing.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Marketing-Readiness-Report.md"), buildReadinessReport(status, techMarketing.plans, fashionMarketing.plans, beautyMarketing.plans), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-8I-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, techMarketing.plans, fashionMarketing.plans, beautyMarketing.plans), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Marketing-Video-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Marketing-Strategy-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "CTA-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Engagement-Optimization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Marketing-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 8 Step 8I Marketing Video Report",
        "",
        `**Phase:** 8 — Video Generation Engine`,
        `**Step:** 8I — AI Marketing Video Engine`,
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
        `| **Marketing Plans Generated** | ${status.marketingPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Marketing Video Plans",
        "",
        `- Technology: ${tech?.length ?? 0} marketing video plans`,
        `- Fashion: ${fashion?.length ?? 0} marketing video plans`,
        `- Beauty: ${beauty?.length ?? 0} marketing video plans`,
        "",
    ].join("\n");
}
function buildStrategyReport(plans) {
    const lines = ["# Marketing Strategy Report — Step 8I", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const s = plan.marketingStrategy;
        lines.push(`## ${plan.profile.storyboardId}`, "", `- Objective: ${s.campaignObjective}`, `- Goal: ${s.marketingGoal}`, `- Audience: ${s.targetAudience}`, `- Value proposition: ${s.valueProposition}`, `- Brand positioning: ${s.brandPositioning}`, "");
    }
    return lines.join("\n");
}
function buildCtaReport(plans) {
    const lines = ["# CTA Planning Report — Step 8I", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const c = plan.callToAction;
        lines.push(`## ${plan.profile.storyboardId}`, "", `- Timing: ${c.ctaTiming}`, `- Position: ${c.ctaPosition}`, `- Style: ${c.ctaStyle}`, `- Animation: ${c.ctaAnimation}`, `- Priority: ${c.ctaPriority}`, "");
    }
    return lines.join("\n");
}
function buildEngagementReport(plans) {
    const lines = ["# Engagement Optimization Report — Step 8I", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans ?? []) {
        const e = plan.engagementOptimization;
        lines.push(`## ${plan.profile.storyboardId}`, "", `- Retention: ${e.viewerRetentionStrategy}`, `- Emotional journey: ${e.emotionalJourney}`, `- Curiosity triggers: ${e.curiosityTriggers.join("; ")}`, `- Shareability: ${e.shareability}`, "");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
    return [
        "# Marketing Readiness Report — Step 8I",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        `**Avg Marketing Quality:** ${status.averageMarketingQualityScore}/100`,
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Marketing video plans | ${status.marketingPlansGenerated} |`,
        `| Production-ready | ${all.filter((p) => p.productionReady).length}/${all.length} |`,
        `| Marketing-ready | ${all.filter((p) => p.marketingReady).length}/${all.length} |`,
        `| Brand consistent | ${all.filter((p) => p.brandConsistent).length}/${all.length} |`,
        "",
        "## Performance",
        "",
        `- Average planning: ${status.performance.averagePlanningMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-marketing-video-engine.js.map