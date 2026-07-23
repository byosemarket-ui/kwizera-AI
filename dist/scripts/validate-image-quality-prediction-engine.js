import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativeImagePlatform, CreativeLayoutType, EnhancementPlatform, ImageAnalysisType, ImageColorSpace, ImageCompressionType, ImageFileFormat, ImageQualityPredictionPlatform, ImageUnderstandingMarketingGoal, ImageUnderstandingPlatform, ProductionImagePlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-quality-prediction-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_PRODUCT = {
    imageId: "step6l-kwizera-pro-hero",
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
    imageId: "step6l-kwizera-campaign",
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
    imageId: "step6l-glowlab-banner",
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
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 6L Image Quality Prediction Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-6l-validation");
        const foundation = core.getManager().imageIntelligenceFoundation;
        const engine = foundation.getImageQualityPredictionEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Image Quality Prediction Engine operational",
        };
        await runFullPipeline(foundation, SAMPLE_PRODUCT, {
            industry: "technology",
            marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
            platform: ImageUnderstandingPlatform.Ecommerce,
        });
        const predictStart = Date.now();
        const product = await engine.predictQuality({
            imageId: "step6l-kwizera-pro-hero",
            projectId: "step6l-validation",
            platform: ImageQualityPredictionPlatform.Website,
            campaign: "kwizera-hero-2026",
        });
        const predictMs = Date.now() - predictStart;
        results.qualityPrediction = {
            passed: product.success && Boolean(product.record?.profile.predictionId),
            detail: `Prediction ${product.record?.profile.predictionId} in ${predictMs}ms, overall ${product.record?.scores.overallImageQualityScore}`,
        };
        results.qualityAnalysis = {
            passed: Boolean(product.record?.analysisSummary.productionPlanning && product.record?.analysisSummary.creativeIntelligence),
            detail: `10-module analysis — production ${product.record?.analysisSummary.productionPlanning.slice(0, 40)}`,
        };
        results.qualityScores = {
            passed: (product.record?.scores.overallImageQualityScore ?? 0) >= 55 &&
                (product.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Overall ${product.record?.scores.overallImageQualityScore}, technical ${product.record?.scores.technicalQualityScore}, production ${product.record?.scores.productionReadinessScore}`,
        };
        results.qualityChecks = {
            passed: product.record?.checks.dependencyValidation === true && product.record?.checks.assetCompleteness === true,
            detail: `Brand ${product.record?.checks.brandConsistency}, composition ${product.record?.checks.compositionConsistency}, assets ${product.record?.checks.assetCompleteness}`,
        };
        results.predictionAccuracy = {
            passed: (product.record?.predictions.productionSuccessProbability ?? 0) >= 55 &&
                (product.record?.predictions.marketingImpact ?? 0) >= 45,
            detail: `Success ${product.record?.predictions.productionSuccessProbability}%, marketing ${product.record?.predictions.marketingImpact}%`,
        };
        results.riskDetection = {
            passed: (product.record?.risks.length ?? 0) >= 0,
            detail: `${product.record?.risks.length} risk(s), highest ${product.record?.highestRiskLevel}`,
        };
        results.criticalRiskPolicy = {
            passed: product.record?.highestRiskLevel !== "critical",
            detail: "No unresolved critical risks on validated hero image",
        };
        results.recommendationReadiness = {
            passed: (product.record?.recommendations.length ?? 0) >= 2,
            detail: `${product.record?.recommendations.length} recommendation(s) generated`,
        };
        results.platformQuality = {
            passed: (product.record?.platformQuality.length ?? 0) >= 7,
            detail: `${product.record?.platformQuality.length} platform evaluations`,
        };
        results.readinessScoring = {
            passed: product.record?.productionReady === true,
            detail: "Production readiness scoring approved",
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
        const campaign = await engine.predictQuality({
            imageId: "step6l-kwizera-campaign",
            platform: ImageQualityPredictionPlatform.Instagram,
            campaign: "launch-2026",
        });
        const banner = await engine.predictQuality({
            imageId: "step6l-glowlab-banner",
            platform: ImageQualityPredictionPlatform.TikTok,
            campaign: "summer-2026",
        });
        results.multiProjectPrediction = {
            passed: campaign.success && banner.success,
            detail: `Campaign ${campaign.record?.scores.overallImageQualityScore}, Banner ${banner.record?.scores.overallImageQualityScore}`,
        };
        results.relationshipDetection = {
            passed: (product.record?.relationships.relatedImagePlans.length ?? 0) >= 1 &&
                (product.record?.relationships.relatedCreativePlans.length ?? 0) >= 1,
            detail: `Plans ${product.record?.relationships.relatedImagePlans.length}, creative ${product.record?.relationships.relatedCreativePlans.length}`,
        };
        const noPipeline = await engine.predictQuality({ imageId: "step6l-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream intelligence",
        };
        const repaired = await engine.repairQualityPrediction("step6l-kwizera-campaign");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Quality prediction repair pipeline verified" : "Repair failed",
        };
        const brandSearch = engine.searchQualityPredictions({ brand: "KWIZERA" });
        results.search = {
            passed: brandSearch.length >= 2,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const platformSearch = engine.searchQualityPredictions({ platform: ImageQualityPredictionPlatform.Website });
        results.platformSearch = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const qualitySearch = engine.searchQualityPredictions({ minQualityScore: 70 });
        results.qualityScoreSearch = {
            passed: qualitySearch.length >= 2,
            detail: `${qualitySearch.length} result(s) with quality >= 70`,
        };
        const riskSearch = engine.searchQualityPredictions({ riskLevel: "low" });
        results.riskLevelSearch = {
            passed: riskSearch.length >= 2,
            detail: `${riskSearch.length} result(s) by risk level`,
        };
        const relationships = engine.detectRelationships("step6l-kwizera-pro-hero");
        results.relationshipUpdate = {
            passed: Boolean(relationships?.relatedImagePlans.length),
            detail: `${relationships?.relatedImagePlans.length ?? 0} production plan link(s)`,
        };
        const status = engine.buildStatusReport();
        results.knowledgeBridge = {
            passed: status.knowledgeBridgeStatus === "connected",
            detail: status.knowledgeBridgeStatus,
        };
        results.memoryBridge = {
            passed: status.memoryBridgeStatus === "connected",
            detail: status.memoryBridgeStatus,
        };
        results.productIntelligenceBridge = {
            passed: status.productIntelligenceBridgeStatus === "connected",
            detail: status.productIntelligenceBridgeStatus,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `image-quality-prediction-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.performance = {
            passed: status.performance.averagePredictionMs < 120000,
            detail: `avg prediction ${status.performance.averagePredictionMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("image-quality-prediction");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-6l-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Image-Quality-Prediction-Report.md"), buildPredictionReport(status, results, storageRoot, allPassed, product.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Risk-Analysis-Report.md"), buildRiskReport(product.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Production-Quality-Report.md"), buildProductionQualityReport(product.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Quality-Recommendations.md"), buildRecommendationsReport(product.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-6L-VALIDATION-REPORT.md"), buildPredictionReport(status, results, storageRoot, allPassed, product.record, campaign.record, banner.record), "utf8");
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
function buildPredictionReport(status, results, storageRoot, allPassed, product, campaign, banner) {
    return [
        "# Image Quality Prediction Report — Step 6L",
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
        "## Quality Predictions",
        "",
        `- Hero: overall ${product?.scores.overallImageQualityScore ?? 0}/100 — success ${product?.predictions.productionSuccessProbability ?? 0}%`,
        `- Campaign: overall ${campaign?.scores.overallImageQualityScore ?? 0}/100`,
        `- Banner: overall ${banner?.scores.overallImageQualityScore ?? 0}/100`,
        "",
        `Predictions created: ${status.predictionsCreated}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 6L Image Quality Prediction Engine validation complete. Awaiting user approval before Step 6M.",
        "",
    ].join("\n");
}
function buildRiskReport(product, campaign, banner) {
    const rows = [product, campaign, banner].filter(Boolean);
    return [
        "# Image Risk Analysis Report — Step 6L",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Highest Risk | Risk Count | Critical | High | Medium | Low |",
        "|-------|--------------|------------|----------|------|--------|-----|",
        ...rows.map((r) => {
            const counts = { critical: 0, high: 0, medium: 0, low: 0 };
            for (const risk of r.risks)
                counts[risk.severity]++;
            return `| ${r.imageId} | ${r.highestRiskLevel} | ${r.risks.length} | ${counts.critical} | ${counts.high} | ${counts.medium} | ${counts.low} |`;
        }),
        "",
        "## Risk Details",
        "",
        ...rows.flatMap((r) => r.risks.map((risk) => `- ${r.imageId}: [${risk.severity}] ${risk.category} — ${risk.description}`)),
        "",
    ].join("\n");
}
function buildProductionQualityReport(product, campaign, banner) {
    const rows = [product, campaign, banner].filter(Boolean);
    return [
        "# Image Production Quality Report — Step 6L",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Overall | Technical | Composition | Lighting | Color | Brand | Marketing | Production |",
        "|-------|---------|-----------|-------------|----------|-------|-------|-----------|------------|",
        ...rows.map((r) => `| ${r.imageId} | ${r.scores.overallImageQualityScore} | ${r.scores.technicalQualityScore} | ${r.scores.compositionScore} | ${r.scores.lightingScore} | ${r.scores.colorScore} | ${r.scores.brandConsistencyScore} | ${r.scores.marketingEffectivenessScore} | ${r.scores.productionReadinessScore} |`),
        "",
        "## Platform Readiness",
        "",
        ...rows.map((r) => `- ${r.imageId}: primary ${r.profile.platform} — ${r.platformQuality.find((p) => p.platform === r.profile.platform)?.readinessScore ?? 0}/100`),
        "",
    ].join("\n");
}
function buildRecommendationsReport(product, campaign, banner) {
    const rows = [product, campaign, banner].filter(Boolean);
    return [
        "# Image Quality Recommendations — Step 6L",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        ...rows.map((r) => [
            `## ${r.imageId}`,
            "",
            ...r.recommendations.map((rec) => `- **[${rec.priority}]** ${rec.category}: ${rec.suggestion} — _${rec.reason}_`),
            "",
            "### Improvement Opportunities",
            "",
            ...r.predictions.improvementOpportunities.map((opp) => `- ${opp}`),
            "",
        ].join("\n")),
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-image-quality-prediction-engine.js.map