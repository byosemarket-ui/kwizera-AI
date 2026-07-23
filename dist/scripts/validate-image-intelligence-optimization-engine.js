import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativeImagePlatform, CreativeLayoutType, EnhancementPlatform, ImageAnalysisType, ImageColorSpace, ImageCompressionType, ImageFileFormat, ImageQualityPredictionPlatform, ImageUnderstandingMarketingGoal, ImageUnderstandingPlatform, ProductionImagePlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-ii-optimization-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_PRODUCT = {
    imageId: "step6m-kwizera-pro-hero",
    imageName: "KWIZERA Pro Studio Hero",
    filePath: "uploads/kwizera-pro-hero.png",
    fileFormat: ImageFileFormat.PNG,
    fileSizeBytes: 1_245_000,
    width: 2400,
    height: 1600,
    colorSpace: ImageColorSpace.SRGB,
    bitDepth: 8,
    compressionType: ImageCompressionType.Lossless,
    hasTransparency: true,
    visual: {
        brightness: 72,
        contrast: 78,
        saturation: 65,
        sharpness: 88,
        noiseLevel: 8,
        whiteBalance: 68,
        exposure: 72,
        dominantColors: ["#1a1a2e", "#e94560", "#ffffff"],
    },
    content: {
        products: ["KWIZERA Pro Studio"],
        background: "studio-white",
        foreground: "KWIZERA Pro Studio",
        logos: ["KWIZERA"],
    },
    imageType: ImageAnalysisType.ProductImage,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    category: "commerce",
    creativeStyle: "commercial",
    tags: ["validation"],
    keywords: ["kwizera", "hero"],
    creationDate: "2026-01-15T10:00:00.000Z",
    lastModifiedDate: "2026-03-20T14:30:00.000Z",
};
const SAMPLE_CAMPAIGN = {
    imageId: "step6m-kwizera-campaign",
    imageName: "KWIZERA Campaign Visual",
    filePath: "uploads/kwizera-campaign.jpg",
    fileFormat: ImageFileFormat.JPEG,
    fileSizeBytes: 980_000,
    width: 1920,
    height: 1080,
    colorSpace: ImageColorSpace.SRGB,
    bitDepth: 8,
    compressionType: ImageCompressionType.Lossy,
    visual: {
        brightness: 70,
        contrast: 80,
        saturation: 68,
        sharpness: 84,
        noiseLevel: 14,
        whiteBalance: 66,
        exposure: 70,
        dominantColors: ["#1a1a2e", "#e94560"],
    },
    content: {
        products: ["KWIZERA Pro Studio"],
        background: "studio-gradient",
        logos: ["KWIZERA"],
        text: ["Launch 2026"],
    },
    imageType: ImageAnalysisType.MarketingImage,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    campaign: "launch-2026",
    category: "marketing",
    creativeStyle: "promotional",
    tags: ["validation"],
    keywords: ["campaign", "launch"],
    creationDate: "2026-02-15T10:00:00.000Z",
    lastModifiedDate: "2026-02-15T10:00:00.000Z",
};
const SAMPLE_BANNER = {
    imageId: "step6m-glowlab-banner",
    imageName: "GlowLab Summer Banner",
    filePath: "uploads/glowlab-banner.webp",
    fileFormat: ImageFileFormat.WebP,
    fileSizeBytes: 420_000,
    width: 1920,
    height: 600,
    bitDepth: 8,
    compressionType: ImageCompressionType.Lossy,
    visual: {
        brightness: 75,
        contrast: 80,
        sharpness: 82,
        noiseLevel: 12,
        whiteBalance: 72,
        exposure: 70,
        saturation: 72,
        dominantColors: ["#ff6b6b", "#feca57"],
    },
    content: {
        background: "gradient-sunset",
        text: ["Summer Sale"],
        products: ["GlowLab Summer Kit"],
        logos: ["GlowLab"],
    },
    imageType: ImageAnalysisType.Banner,
    brand: "GlowLab",
    campaign: "summer-2026",
    category: "marketing",
    creativeStyle: "promotional",
    tags: ["validation"],
    keywords: ["summer", "glowlab"],
    creationDate: "2026-05-01T12:00:00.000Z",
    lastModifiedDate: "2026-05-01T12:00:00.000Z",
};
async function runFullPipeline(foundation, sample, opts) {
    const imageId = sample.imageId;
    await foundation.getImageAnalysisEngine().analyzeImage(sample);
    await foundation.getImageUnderstandingEngine().understandImage({
        imageId,
        industry: opts?.industry,
        marketingGoal: opts?.marketingGoal,
        platform: opts?.platform,
    });
    await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId });
    await foundation.getBackgroundIntelligenceEngine().analyzeBackground({ imageId });
    await foundation.getCompositionIntelligenceEngine().analyzeComposition({ imageId });
    await foundation.getLightingColorIntelligenceEngine().analyzeLightingColor({ imageId });
    await foundation.getBrandVisualIntelligenceEngine().analyzeBrandVisual({
        imageId,
        brandName: sample.brand,
        industry: opts?.industry,
    });
    await foundation.getImageEnhancementPlanningEngine().planEnhancement({
        imageId,
        platform: EnhancementPlatform.Website,
    });
    await foundation.getCreativeImageIntelligenceEngine().planCreativeImage({
        imageId,
        platform: CreativeImagePlatform.WebsiteBanner,
        layoutType: CreativeLayoutType.ProductShowcase,
    });
    await foundation.getProductionImagePlanningEngine().planProduction({
        imageId,
        platform: ProductionImagePlatform.Website,
    });
    await foundation.getImageQualityPredictionEngine().predictQuality({
        imageId,
        projectId: "step6m-validation",
        platform: ImageQualityPredictionPlatform.Website,
        campaign: sample.campaign ?? "validation",
    });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 6M Image Intelligence Optimization Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-6m-validation");
        const foundation = core.getManager().imageIntelligenceFoundation;
        const engine = foundation.getImageIntelligenceOptimizationEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Image Intelligence Optimization Engine operational",
        };
        await runFullPipeline(foundation, SAMPLE_PRODUCT, {
            industry: "technology",
            marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
            platform: ImageUnderstandingPlatform.Ecommerce,
        });
        const optStart = Date.now();
        const hero = await engine.runOptimization({ imageId: "step6m-kwizera-pro-hero", projectId: "step6m-validation" });
        const optMs = Date.now() - optStart;
        results.optimizationRun = {
            passed: hero.success && Boolean(hero.record),
            detail: `Hero optimization in ${optMs}ms, improvement ${hero.record?.scores.overallImprovementScore}`,
        };
        results.optimizationProfile = {
            passed: Boolean(hero.record?.profile.optimizationId) &&
                Boolean(hero.record?.profile.imageId) &&
                Boolean(hero.record?.recoveryPointId),
            detail: `Optimization ${hero.record?.profile.optimizationId}, v${hero.record?.profile.optimizationVersion}`,
        };
        results.moduleOptimization = {
            passed: (hero.record?.moduleResults.length ?? 0) === 11 &&
                hero.record?.moduleResults.every((m) => m.qualityScoreAfter >= m.qualityScoreBefore) === true,
            detail: `${hero.record?.moduleResults.length} modules optimized without quality reduction`,
        };
        results.optimizationStrategies = {
            passed: Boolean(hero.record?.strategies.cacheOptimization) &&
                Boolean(hero.record?.strategies.searchOptimization) &&
                Boolean(hero.record?.strategies.performanceOptimization),
            detail: "All optimization strategy categories applied",
        };
        results.cacheOptimization = {
            passed: (hero.record?.cache.images.length ?? 0) >= 1 &&
                (hero.record?.cache.brands.length ?? 0) >= 1 &&
                (hero.record?.cache.productionPlans.length ?? 0) >= 1 &&
                (hero.record?.cache.hitRate ?? 0) > 0,
            detail: `Cache hit rate ${hero.record?.cache.hitRate}%, ${hero.record?.cache.templates.length} templates cached`,
        };
        results.performanceImprovement = {
            passed: (hero.record?.performance.planningSpeedMs ?? 999) <= (hero.record?.performance.planningSpeedBeforeMs ?? 0) &&
                (hero.record?.scores.planningImprovementScore ?? 0) >= 0,
            detail: `Planning ${hero.record?.performance.planningSpeedBeforeMs}ms → ${hero.record?.performance.planningSpeedMs}ms`,
        };
        results.recommendationImprovement = {
            passed: (hero.record?.scores.recommendationImprovementScore ?? 0) >= 5,
            detail: `Recommendation improvement ${hero.record?.scores.recommendationImprovementScore}/100`,
        };
        results.relationshipImprovement = {
            passed: (hero.record?.scores.relationshipImprovementScore ?? 0) >= 5,
            detail: `Relationship improvement ${hero.record?.scores.relationshipImprovementScore}/100`,
        };
        results.workflowOptimization = {
            passed: Boolean(hero.record?.strategies.workflowOptimization) &&
                (hero.record?.scores.workflowEfficiencyScore ?? 0) >= 10,
            detail: `Workflow efficiency ${hero.record?.scores.workflowEfficiencyScore}/100`,
        };
        results.recoveryPoint = {
            passed: Boolean(hero.record?.recoveryPointId) && hero.recovered !== true,
            detail: `Recovery point ${hero.record?.recoveryPointId} created before optimization`,
        };
        results.optimizationScores = {
            passed: (hero.record?.scores.overallImprovementScore ?? 0) >= 5 &&
                (hero.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Overall ${hero.record?.scores.overallImprovementScore}, confidence ${hero.record?.scores.aiConfidenceScore}`,
        };
        await runFullPipeline(foundation, SAMPLE_CAMPAIGN, {
            industry: "technology",
            marketingGoal: ImageUnderstandingMarketingGoal.Launch,
            platform: ImageUnderstandingPlatform.Social,
        });
        await runFullPipeline(foundation, SAMPLE_BANNER, {
            industry: "beauty",
            marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
            platform: ImageUnderstandingPlatform.Social,
        });
        const campaign = await engine.runOptimization({ imageId: "step6m-kwizera-campaign" });
        const banner = await engine.runOptimization({ imageId: "step6m-glowlab-banner" });
        results.multiProjectOptimization = {
            passed: campaign.success && banner.success,
            detail: `Campaign improvement ${campaign.record?.scores.overallImprovementScore}, Banner ${banner.record?.scores.overallImprovementScore}`,
        };
        results.relationshipDetection = {
            passed: (hero.record?.relationships.qualityPredictions.length ?? 0) >= 1 &&
                (hero.record?.relationships.productionPlans.length ?? 0) >= 1,
            detail: `Quality predictions ${hero.record?.relationships.qualityPredictions.length}, knowledge ${hero.record?.relationships.knowledgeRecords.length}`,
        };
        const noPipeline = await engine.runOptimization({ imageId: "step6m-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream intelligence",
        };
        const repaired = await engine.repairOptimization("step6m-kwizera-campaign");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Optimization repair pipeline verified" : "Repair failed",
        };
        const recoveryId = hero.record?.recoveryPointId;
        const restoreTest = recoveryId ? engine.restoreRecoveryPoint(recoveryId) : false;
        results.recoveryValidation = {
            passed: restoreTest === true,
            detail: restoreTest ? "Recovery point restore verified" : "Recovery restore failed",
        };
        const optSearch = engine.searchOptimizations({ optimizationId: hero.record?.optimizationId });
        results.searchByOptimization = {
            passed: optSearch.length >= 1,
            detail: `${optSearch.length} result(s) by optimization`,
        };
        const brandSearch = engine.searchOptimizations({ brand: "KWIZERA" });
        results.searchByBrand = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const scoreSearch = engine.searchOptimizations({ minImprovementScore: 5 });
        results.searchByImprovementScore = {
            passed: scoreSearch.length >= 1,
            detail: `${scoreSearch.length} result(s) above improvement threshold`,
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageOptimizationMs < 120000,
            detail: `avg optimization ${status.performance.averageOptimizationMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `image-intelligence-optimization-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("image-intelligence-optimization");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        results.recommendationReadiness = {
            passed: hero.record?.productionReady === true && hero.record?.validated === true,
            detail: "Optimized Image Intelligence system ready for continued operation",
        };
        await core.stop("step-6m-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Image-Optimization-Report.md"), buildOptimizationReport(status, results, storageRoot, allPassed, hero.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Performance-Optimization-Report.md"), buildPerformanceReport(hero.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Recommendation-Optimization-Report.md"), buildRecommendationReport(hero.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Workflow-Optimization-Report.md"), buildWorkflowReport(hero.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-6M-VALIDATION-REPORT.md"), buildOptimizationReport(status, results, storageRoot, allPassed, hero.record, campaign.record, banner.record), "utf8");
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
function buildOptimizationReport(status, results, storageRoot, allPassed, hero, campaign, banner) {
    return [
        "# Image Optimization Report — Step 6M",
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
        "## Optimizations Completed",
        "",
        `- Hero: ${hero?.moduleResults.length ?? 0} modules, improvement ${hero?.scores.overallImprovementScore ?? 0}/100`,
        `- Campaign: improvement ${campaign?.scores.overallImprovementScore ?? 0}/100`,
        `- Banner: improvement ${banner?.scores.overallImprovementScore ?? 0}/100`,
        "",
        `Total optimizations: ${status.optimizationsCompleted}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 6M Image Intelligence Optimization Engine validation complete. Awaiting user approval before Step 6N.",
        "",
    ].join("\n");
}
function buildPerformanceReport(hero, campaign, banner) {
    const rows = [hero, campaign, banner].filter(Boolean);
    return [
        "# Image Performance Optimization Report — Step 6M",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Planning Before | Planning After | Search Before | Search After | Planning Δ | Search Δ |",
        "|-------|-----------------|----------------|---------------|--------------|------------|----------|",
        ...rows.map((r) => `| ${r.imageId} | ${r.performance.planningSpeedBeforeMs}ms | ${r.performance.planningSpeedMs}ms | ${r.performance.searchSpeedBeforeMs}ms | ${r.performance.searchSpeedMs}ms | ${r.scores.planningImprovementScore}% | ${r.scores.searchImprovementScore}% |`),
        "",
        "## Resource Estimates",
        "",
        ...rows.map((r) => `- **${r.imageId}:** ~${r.performance.memoryEstimateMb}MB memory, ~${r.performance.diskUsageEstimateKb}KB disk`),
        "",
    ].join("\n");
}
function buildRecommendationReport(hero, campaign, banner) {
    const rows = [hero, campaign, banner].filter(Boolean);
    const lines = [
        "# Image Recommendation Optimization Report — Step 6M",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.imageId}`, "", `- **Recommendation Improvement:** ${record.scores.recommendationImprovementScore}/100`, `- **Confidence Improvement:** ${record.scores.confidenceImprovementScore}/100`, "", "### Strategies", `- ${record.strategies.recommendationOptimization}`, `- ${record.strategies.knowledgeRetrievalOptimization}`, "", "### Module Improvements", "| Module | Before | After | Strategies |", "|--------|--------|-------|------------|");
        for (const mod of record.moduleResults.filter((m) => m.strategiesApplied.includes("recommendation"))) {
            lines.push(`| ${mod.moduleName} | ${mod.qualityScoreBefore} | ${mod.qualityScoreAfter} | ${mod.strategiesApplied.join(", ")} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildWorkflowReport(hero, campaign, banner) {
    const rows = [hero, campaign, banner].filter(Boolean);
    const lines = [
        "# Image Workflow Optimization Report — Step 6M",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.imageId} — ${record.profile.platform}`, "", `- **Workflow Efficiency:** ${record.scores.workflowEfficiencyScore}/100`, `- **Workflow Optimization:** ${record.strategies.workflowOptimization}`, `- **Performance Optimization:** ${record.strategies.performanceOptimization}`, "", "| Module | Improved | Detail |", "|--------|----------|--------|");
        for (const mod of record.moduleResults) {
            lines.push(`| ${mod.moduleName} | ${mod.improved ? "✅" : "❌"} | ${mod.detail.slice(0, 60)}... |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
void main();
//# sourceMappingURL=validate-image-intelligence-optimization-engine.js.map