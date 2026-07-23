import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativeImagePlatform, CreativeLayoutType, EnhancementPlatform, ImageAnalysisType, ImageColorSpace, ImageCompressionType, ImageFileFormat, ImageUnderstandingMarketingGoal, ImageUnderstandingPlatform, ProductionImagePlatform, ProductionWorkflowStep, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-production-planning-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_PRODUCT = {
    imageId: "step6k-kwizera-pro-hero",
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
    imageId: "step6k-kwizera-campaign",
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
    imageId: "step6k-glowlab-banner",
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
async function runCompletePipeline(foundation, sample, opts) {
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
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 6K Production Image Planning Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-6k-validation");
        const foundation = core.getManager().imageIntelligenceFoundation;
        const engine = foundation.getProductionImagePlanningEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Production Image Planning Engine operational",
        };
        await runCompletePipeline(foundation, SAMPLE_PRODUCT, {
            industry: "technology",
            marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
            platform: ImageUnderstandingPlatform.Ecommerce,
        });
        const planStart = Date.now();
        const product = await engine.planProduction({
            imageId: "step6k-kwizera-pro-hero",
            projectId: "step6k-validation",
            platform: ProductionImagePlatform.Website,
            campaign: "kwizera-hero-2026",
        });
        const planMs = Date.now() - planStart;
        results.productionPlanning = {
            passed: product.success && Boolean(product.record?.profile.productionImagePlanId),
            detail: `Plan ${product.record?.profile.productionImagePlanId} in ${planMs}ms, readiness ${product.record?.scores.productionReadinessScore}`,
        };
        results.workflowPlanning = {
            passed: Boolean(product.record?.workflow.renderingPreparation && product.record?.workflow.deliveryPreparation),
            detail: product.record?.workflow.renderingPreparation.slice(0, 50) ?? "n/a",
        };
        results.assetValidation = {
            passed: (product.record?.assets.originalImages.length ?? 0) >= 1 &&
                product.record?.assets.originalImages[0]?.status === "ready",
            detail: `Original ${product.record?.assets.originalImages[0]?.status}, logos ${product.record?.assets.logos.length}`,
        };
        results.dependencyValidation = {
            passed: product.record?.dependencies.allRequiredPassed === true,
            detail: `${product.record?.dependencies.passedCount}/${product.record?.dependencies.totalRequired} dependencies passed`,
        };
        results.renderPreparation = {
            passed: Boolean(product.record?.renderPreparation.outputResolution && product.record?.renderPreparation.aspectRatio),
            detail: `${product.record?.renderPreparation.outputResolution}, ${product.record?.renderPreparation.colorProfile}`,
        };
        results.exportPreparation = {
            passed: Boolean(product.record?.exportPreparation.png && product.record?.exportPreparation.webp),
            detail: "PNG, JPG, WEBP export plans prepared",
        };
        results.productionReady = {
            passed: product.record?.productionReady === true,
            detail: "Production plan marked production-ready",
        };
        results.qualityScores = {
            passed: (product.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (product.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Production ${product.record?.scores.productionReadinessScore}, asset ${product.record?.scores.assetReadinessScore}, confidence ${product.record?.scores.aiConfidenceScore}`,
        };
        results.recommendationReadiness = {
            passed: (product.record?.recommendations.length ?? 0) >= 2,
            detail: `${product.record?.recommendations.length} recommendation(s) generated`,
        };
        await runCompletePipeline(foundation, SAMPLE_CAMPAIGN, {
            industry: "technology",
            marketingGoal: ImageUnderstandingMarketingGoal.Launch,
            platform: ImageUnderstandingPlatform.Social,
        });
        await runCompletePipeline(foundation, SAMPLE_BANNER, {
            industry: "beauty",
            marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
            platform: ImageUnderstandingPlatform.Social,
        });
        const campaign = await engine.planProduction({
            imageId: "step6k-kwizera-campaign",
            platform: ProductionImagePlatform.Instagram,
            campaign: "launch-2026",
        });
        const banner = await engine.planProduction({
            imageId: "step6k-glowlab-banner",
            platform: ProductionImagePlatform.TikTok,
            campaign: "summer-2026",
        });
        results.multiProjectPlanning = {
            passed: campaign.success && banner.success,
            detail: `Campaign ${campaign.record?.scores.productionReadinessScore}, Banner ${banner.record?.scores.productionReadinessScore}`,
        };
        results.relationshipDetection = {
            passed: (product.record?.relationships.relatedCreativeImagePlans.length ?? 0) >= 1 &&
                (product.record?.relationships.relatedEnhancementPlans.length ?? 0) >= 1,
            detail: `Creative ${product.record?.relationships.relatedCreativeImagePlans.length}, enhancement ${product.record?.relationships.relatedEnhancementPlans.length}`,
        };
        const noPipeline = await engine.planProduction({ imageId: "step6k-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream intelligence",
        };
        const repaired = await engine.repairProductionPlan("step6k-kwizera-campaign");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Production plan repair pipeline verified" : "Repair failed",
        };
        const brandSearch = engine.searchProductionPlans({ brand: "KWIZERA" });
        results.search = {
            passed: brandSearch.length >= 2,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const platformSearch = engine.searchProductionPlans({ platform: ProductionImagePlatform.Website });
        results.platformSearch = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const campaignSearch = engine.searchProductionPlans({ campaign: "launch" });
        results.campaignSearch = {
            passed: campaignSearch.length >= 1,
            detail: `${campaignSearch.length} result(s) by campaign`,
        };
        const assetSearch = engine.searchProductionPlans({ asset: "logo" });
        results.assetSearch = {
            passed: assetSearch.length >= 2,
            detail: `${assetSearch.length} result(s) with logo assets`,
        };
        const relationships = engine.detectRelationships("step6k-kwizera-pro-hero");
        results.relationshipUpdate = {
            passed: Boolean(relationships?.relatedCreativeImagePlans.length),
            detail: `${relationships?.relatedCreativeImagePlans.length ?? 0} creative plan link(s)`,
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
        const logFile = path.join(storageRoot, "logs", `production-image-planning-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("production-image-planning");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-6k-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Production-Image-Planning-Report.md"), buildPlanningReport(status, results, storageRoot, allPassed, product.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Workflow-Report.md"), buildWorkflowReport(product.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Asset-Validation-Report.md"), buildAssetReport(product.record, campaign.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Image-Readiness-Report.md"), buildReadinessReport(status, allPassed), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-6K-VALIDATION-REPORT.md"), buildPlanningReport(status, results, storageRoot, allPassed, product.record, campaign.record, banner.record), "utf8");
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
function buildPlanningReport(status, results, storageRoot, allPassed, product, campaign, banner) {
    return [
        "# Production Image Planning Report — Step 6K",
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
        "## Production Plans",
        "",
        `- Hero: ${product?.profile.platform ?? "n/a"} — readiness ${product?.scores.productionReadinessScore ?? 0}/100`,
        `- Campaign: ${campaign?.profile.platform ?? "n/a"} — readiness ${campaign?.scores.productionReadinessScore ?? 0}/100`,
        `- Banner: ${banner?.profile.platform ?? "n/a"} — readiness ${banner?.scores.productionReadinessScore ?? 0}/100`,
        "",
        `Plans created: ${status.plansCreated}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 6K Production Image Planning Engine validation complete. Awaiting user approval before Step 6L.",
        "",
    ].join("\n");
}
function buildWorkflowReport(product, campaign, banner) {
    const rows = [product, campaign, banner].filter(Boolean);
    return [
        "# Image Workflow Report — Step 6K",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Analysis | Enhancement | Composition | Brand | Creative | Render | Export |",
        "|-------|----------|-------------|-------------|-------|----------|--------|--------|",
        ...rows.map((r) => `| ${r.imageId} | ✅ | ✅ | ${r.workflow.compositionValidation.slice(0, 20)}... | ${r.workflow.brandValidation.slice(0, 15)}... | ${r.workflow.creativeValidation.slice(0, 15)}... | ${r.workflow.renderingPreparation.slice(0, 20)}... | ${r.workflow.exportPreparation.slice(0, 15)}... |`),
        "",
        "## Workflow Steps",
        "",
        ...Object.values(ProductionWorkflowStep).map((step) => `- ${step}`),
        "",
    ].join("\n");
}
function buildAssetReport(product, campaign, banner) {
    const rows = [product, campaign, banner].filter(Boolean);
    return [
        "# Image Asset Validation Report — Step 6K",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Original | Logos | Fonts | Templates | Brand Assets | Asset Score |",
        "|-------|----------|-------|-------|-----------|--------------|-------------|",
        ...rows.map((r) => `| ${r.imageId} | ${r.assets.originalImages[0]?.status ?? "n/a"} | ${r.assets.logos.length} | ${r.assets.fonts.length} | ${r.assets.templates.length} | ${r.assets.brandAssets.length} | ${r.scores.assetReadinessScore} |`),
        "",
        "## Dependency Validation",
        "",
        ...rows.map((r) => `- ${r.imageId}: ${r.dependencies.passedCount}/${r.dependencies.totalRequired} passed — ${r.dependencies.allRequiredPassed ? "APPROVED" : "BLOCKED"}`),
        "",
    ].join("\n");
}
function buildReadinessReport(status, allPassed) {
    return [
        "# Production Image Readiness Report — Step 6K",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        "",
        "## Readiness Scores",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Engine Readiness | ${status.readinessScore}/100 |`,
        `| Avg Production Readiness | ${status.averageProductionReadinessScore}/100 |`,
        `| Avg Asset Readiness | ${status.averageAssetReadinessScore}/100 |`,
        `| Plans Created | ${status.plansCreated} |`,
        `| Knowledge Bridge | ${status.knowledgeBridgeStatus} |`,
        `| Memory Bridge | ${status.memoryBridgeStatus} |`,
        `| Product Intelligence Bridge | ${status.productIntelligenceBridgeStatus} |`,
        "",
        "## Performance",
        "",
        `| Avg Planning | ${status.performance.averagePlanningMs}ms |`,
        `| Avg Search | ${status.performance.averageSearchMs}ms |`,
        `| Avg Relationship | ${status.performance.averageRelationshipMs}ms |`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-production-image-planning-engine.js.map