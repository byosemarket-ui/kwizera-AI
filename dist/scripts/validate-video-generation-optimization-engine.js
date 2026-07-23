import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, OPTIMIZATION_PLATFORM_TARGETS, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, StoryboardGenerationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-optimization-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step8m-kwizera-pro",
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
    productId: "step8m-kwizera-jacket",
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
    productId: "step8m-glow-serum",
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
    const rendering = await genFoundation.getRenderingPreparationEngine().prepareRenderPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!rendering.success)
        return undefined;
    const quality = await genFoundation.getVideoQualityValidationEngine().validateVideoQuality({
        storyboardId: story.record.storyboardId,
    });
    if (!quality.success)
        return undefined;
    return story.record.storyboardId;
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 8M Video Generation Optimization Engine Validation");
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
        await core.start("step-8m-validation");
        const initMs = Date.now() - initStart;
        const genFoundation = core.getManager().videoGenerationFoundation;
        const optimizationEngine = genFoundation.getVideoGenerationOptimizationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: optimizationEngine.isInitialized() && optimizationEngine.isStartupComplete(),
            detail: optimizationEngine.isStartupComplete()
                ? `Video Generation Optimization Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = genFoundation.getRegistry().getModule("video-generation-optimization-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        const techStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm);
        const fashionStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels);
        const beautyStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok);
        results.validationUpstream = {
            passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
            detail: "Approved validation reports prepared for optimization",
        };
        const techOptimization = await optimizationEngine.optimizeVideoGeneration({ storyboardId: techStoryboardId });
        const fashionOptimization = await optimizationEngine.optimizeVideoGeneration({ storyboardId: fashionStoryboardId });
        const beautyOptimization = await optimizationEngine.optimizeVideoGeneration({ storyboardId: beautyStoryboardId });
        results.optimization = {
            passed: techOptimization.success && fashionOptimization.success && beautyOptimization.success,
            detail: `Tech ${techOptimization.optimizations?.length ?? 0}, Fashion ${fashionOptimization.optimizations?.length ?? 0}, Beauty ${beautyOptimization.optimizations?.length ?? 0} optimizations`,
        };
        const firstRecord = techOptimization.optimizations?.[0];
        results.componentOptimization = {
            passed: firstRecord?.componentOptimization.storyboardOptimized === true &&
                firstRecord?.componentOptimization.validationResultsOptimized === true &&
                firstRecord?.componentOptimization.renderPreparationOptimized === true,
            detail: `All ${Object.keys(firstRecord?.componentOptimization ?? {}).filter((k) => k.endsWith("Optimized")).length} component flags set`,
        };
        results.pipelineOptimization = {
            passed: firstRecord?.pipelineOptimization.allPipelineOptimized === true &&
                firstRecord?.pipelineOptimization.creativeDecisionsPreserved === true,
            detail: `Story flow: ${firstRecord?.pipelineOptimization.storyFlow.slice(0, 40)}...`,
        };
        results.resourceOptimization = {
            passed: firstRecord?.resourceOptimization.allResourcesOptimized === true &&
                Boolean(firstRecord?.resourceOptimization.cpuUsage && firstRecord?.resourceOptimization.parallelProcessing),
            detail: `Parallel: ${firstRecord?.resourceOptimization.parallelProcessing.slice(0, 35)}...`,
        };
        results.qualityOptimization = {
            passed: firstRecord?.qualityOptimization.allQualityOptimized === true &&
                firstRecord?.qualityOptimization.qualityMaintainedOrImproved === true,
            detail: `Quality maintained: ${firstRecord?.qualityOptimization.qualityMaintainedOrImproved}`,
        };
        results.searchOptimization = {
            passed: firstRecord?.searchOptimization.allSearchOptimized === true &&
                Boolean(firstRecord?.searchOptimization.searchIndexes && firstRecord?.searchOptimization.metadata),
            detail: firstRecord?.searchOptimization.cachePerformance,
        };
        results.recoveryOptimization = {
            passed: firstRecord?.recoveryOptimization.allRecoveryOptimized === true &&
                Boolean(firstRecord?.recoveryOptimization.automaticRecovery),
            detail: `Checkpoints: ${firstRecord?.recoveryOptimization.recoveryCheckpoints.slice(0, 40)}...`,
        };
        results.performanceOptimization = {
            passed: firstRecord?.performanceOptimization.allPerformanceOptimized === true &&
                Boolean(firstRecord?.performanceOptimization.generationSpeed && firstRecord?.performanceOptimization.scalability),
            detail: firstRecord?.performanceOptimization.scalability,
        };
        results.dependencyValidation = {
            passed: firstRecord?.dependencyValidation.allDependenciesReady === true,
            detail: `Dependencies ready: ${firstRecord?.dependencyValidation.allDependenciesReady}`,
        };
        results.optimizationScores = {
            passed: (firstRecord?.scores.optimizationScore ?? 0) >= 55 &&
                (firstRecord?.scores.performanceScore ?? 0) >= 50 &&
                (firstRecord?.scores.resourceEfficiencyScore ?? 0) >= 50 &&
                (firstRecord?.scores.qualityImprovementScore ?? 0) >= 50 &&
                (firstRecord?.scores.productionReadinessScore ?? 0) >= 55 &&
                (firstRecord?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Optimization ${firstRecord?.scores.optimizationScore}, performance ${firstRecord?.scores.performanceScore}, confidence ${firstRecord?.scores.aiConfidenceScore}`,
        };
        results.approvalGate = {
            passed: techOptimization.optimizations?.every((o) => o.approved && o.validated) ?? false,
            detail: "All optimizations approved after validation",
        };
        results.relationships = {
            passed: (firstRecord?.relationships.storyboards.length ?? 0) >= 1 &&
                (firstRecord?.relationships.validationReports.length ?? 0) >= 1 &&
                (firstRecord?.relationships.renderPlans.length ?? 0) >= 1,
            detail: `Validation reports ${firstRecord?.relationships.validationReports.length}, render plans ${firstRecord?.relationships.renderPlans.length}`,
        };
        results.platformTargets = {
            passed: OPTIMIZATION_PLATFORM_TARGETS.length === 7,
            detail: `${OPTIMIZATION_PLATFORM_TARGETS.length} platform targets configured`,
        };
        results.recommendationQuality = {
            passed: (firstRecord?.recommendations.length ?? 0) >= 2,
            detail: `${firstRecord?.recommendations.length} recommendations`,
        };
        const noUpstream = await optimizationEngine.optimizeVideoGeneration({ storyboardId: "step8m-nonexistent" });
        results.incompleteRejection = {
            passed: !noUpstream.success,
            detail: noUpstream.message ?? "Rejected without validation reports",
        };
        const repaired = await optimizationEngine.repairOptimization(techStoryboardId);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Optimization repair verified" : "Repair failed",
        };
        const optimizationSearch = optimizationEngine.searchOptimizations({ optimization: "optimized" });
        results.searchByOptimization = {
            passed: optimizationSearch.length >= 1,
            detail: `${optimizationSearch.length} result(s) by optimization`,
        };
        const performanceSearch = optimizationEngine.searchOptimizations({ performance: "parallel" });
        results.searchByPerformance = {
            passed: performanceSearch.length >= 1,
            detail: `${performanceSearch.length} result(s) by performance`,
        };
        const productSearch = optimizationEngine.searchOptimizations({ productId: "step8m-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const keywordSearch = optimizationEngine.searchOptimizations({ keywords: "creative" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstRecord.optimizationId);
        results.generationAssetRegistration = {
            passed: assetRegistered?.assetType === "template",
            detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
        };
        const status = optimizationEngine.buildStatusReport();
        results.enginePerformance = {
            passed: status.performance.averageOptimizationMs < 120000,
            detail: `avg optimization ${status.performance.averageOptimizationMs}ms, repair ${status.performance.averageRepairMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `video-generation-optimization-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashionOptimization.success && beautyOptimization.success,
            detail: `Fashion ${fashionOptimization.optimizations?.length} optimizations, Beauty ${beautyOptimization.optimizations?.length} optimizations`,
        };
        await core.stop("step-8m-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Video-Generation-Optimization-Report.md"), buildMainReport(status, results, storageRoot, allPassed, techOptimization.optimizations, fashionOptimization.optimizations, beautyOptimization.optimizations), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Pipeline-Optimization-Report.md"), buildPipelineReport(techOptimization.optimizations), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Performance-Optimization-Report.md"), buildPerformanceReport(techOptimization.optimizations), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Resource-Optimization-Report.md"), buildResourceReport(techOptimization.optimizations), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Optimization-Report.md"), buildProductionReport(status, techOptimization.optimizations, fashionOptimization.optimizations, beautyOptimization.optimizations), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-8M-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, techOptimization.optimizations, fashionOptimization.optimizations, beautyOptimization.optimizations), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Video-Generation-Optimization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Pipeline-Optimization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Performance-Optimization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Resource-Optimization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Production-Optimization-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 8 Step 8M Video Generation Optimization Report",
        "",
        `**Phase:** 8 — Video Generation Engine`,
        `**Step:** 8M — AI Video Generation Optimization Engine`,
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
        `| **Optimizations Generated** | ${status.optimizationsGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Optimizations",
        "",
        `- Technology: ${tech?.length ?? 0} optimizations`,
        `- Fashion: ${fashion?.length ?? 0} optimizations`,
        `- Beauty: ${beauty?.length ?? 0} optimizations`,
        "",
    ].join("\n");
}
function buildPipelineReport(optimizations) {
    const lines = ["# Pipeline Optimization Report — Step 8M", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const record of optimizations ?? []) {
        const p = record.pipelineOptimization;
        lines.push(`## ${record.optimizationId}`, "", `- Story flow: ${p.storyFlow}`, `- Timeline efficiency: ${p.timelineEfficiency}`, `- Camera efficiency: ${p.cameraEfficiency}`, `- Creative preserved: ${p.creativeDecisionsPreserved}`, `- All pipeline optimized: ${p.allPipelineOptimized}`, "");
    }
    return lines.join("\n");
}
function buildPerformanceReport(optimizations) {
    const lines = ["# Performance Optimization Report — Step 8M", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const record of optimizations ?? []) {
        const p = record.performanceOptimization;
        lines.push(`## ${record.optimizationId}`, "", `- Generation speed: ${p.generationSpeed}`, `- Validation speed: ${p.validationSpeed}`, `- Scalability: ${p.scalability}`, `- Performance score: ${record.scores.performanceScore}`, "");
    }
    return lines.join("\n");
}
function buildResourceReport(optimizations) {
    const lines = ["# Resource Optimization Report — Step 8M", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const record of optimizations ?? []) {
        const r = record.resourceOptimization;
        lines.push(`## ${record.optimizationId}`, "", `- CPU: ${r.cpuUsage}`, `- GPU: ${r.gpuUsage}`, `- RAM: ${r.ramUsage}`, `- Cache: ${r.cacheUsage}`, `- Parallel processing: ${r.parallelProcessing}`, `- Resource efficiency score: ${record.scores.resourceEfficiencyScore}`, "");
    }
    return lines.join("\n");
}
function buildProductionReport(status, tech, fashion, beauty) {
    const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
    return [
        "# Production Optimization Report — Step 8M",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        `**Avg Optimization Score:** ${status.averageOptimizationScore}/100`,
        `**Avg Production Readiness:** ${status.averageProductionReadinessScore}/100`,
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Optimizations | ${status.optimizationsGenerated} |`,
        `| Approved | ${all.filter((o) => o.approved).length}/${all.length} |`,
        `| Validated | ${all.filter((o) => o.validated).length}/${all.length} |`,
        `| Brand consistent | ${all.filter((o) => o.brandConsistent).length}/${all.length} |`,
        "",
        "## Performance",
        "",
        `- Average optimization: ${status.performance.averageOptimizationMs}ms`,
        `- Average repair: ${status.performance.averageRepairMs}ms`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-video-generation-optimization-engine.js.map