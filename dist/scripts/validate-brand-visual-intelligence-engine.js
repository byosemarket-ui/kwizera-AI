import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrandVisualStyle, createAiCore, ImageAnalysisType, ImageColorSpace, ImageCompressionType, ImageFileFormat, ImageUnderstandingMarketingGoal, ImageUnderstandingPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-brand-visual-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_KWIZERA_PRODUCT = {
    imageId: "step6h-kwizera-pro-hero",
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
    metadata: { camera: "studio-rig" },
    creationDate: "2026-01-15T10:00:00.000Z",
    lastModifiedDate: "2026-03-20T14:30:00.000Z",
    imageType: ImageAnalysisType.ProductImage,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    category: "commerce",
    creativeStyle: "commercial",
    visual: {
        brightness: 72,
        contrast: 78,
        saturation: 65,
        sharpness: 88,
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
    tags: ["product", "kwizera", "validation"],
    keywords: ["hero", "studio", "kwizera"],
};
const SAMPLE_KWIZERA_LIFESTYLE = {
    imageId: "step6h-kwizera-lifestyle",
    imageName: "KWIZERA Urban Lifestyle",
    filePath: "uploads/kwizera-lifestyle.jpg",
    fileFormat: ImageFileFormat.JPEG,
    fileSizeBytes: 890_000,
    width: 1920,
    height: 1280,
    colorSpace: ImageColorSpace.SRGB,
    bitDepth: 8,
    compressionType: ImageCompressionType.Lossy,
    metadata: { location: "urban" },
    creationDate: "2026-02-10T09:00:00.000Z",
    lastModifiedDate: "2026-02-10T09:00:00.000Z",
    imageType: ImageAnalysisType.LifestyleImage,
    product: "KWIZERA Urban Jacket",
    brand: "KWIZERA",
    category: "lifestyle",
    creativeStyle: "editorial",
    visual: {
        brightness: 68,
        contrast: 72,
        saturation: 58,
        sharpness: 80,
        whiteBalance: 55,
        exposure: 65,
        dominantColors: ["#2d3436", "#636e72"],
    },
    content: {
        products: ["KWIZERA Urban Jacket"],
        background: "urban-street",
        foreground: "model-with-jacket",
        logos: ["KWIZERA"],
        objects: ["person", "clothing"],
    },
    tags: ["lifestyle", "validation"],
    keywords: ["urban", "kwizera"],
};
const SAMPLE_GLOWLAB = {
    imageId: "step6h-glowlab-banner",
    imageName: "GlowLab Summer Banner",
    filePath: "uploads/glowlab-banner.webp",
    fileFormat: ImageFileFormat.WebP,
    fileSizeBytes: 420_000,
    width: 1920,
    height: 600,
    bitDepth: 8,
    compressionType: ImageCompressionType.Lossy,
    metadata: { campaign: "summer-2026" },
    creationDate: "2026-05-01T12:00:00.000Z",
    lastModifiedDate: "2026-05-01T12:00:00.000Z",
    imageType: ImageAnalysisType.Banner,
    brand: "GlowLab",
    campaign: "summer-2026",
    category: "marketing",
    creativeStyle: "promotional",
    visual: {
        brightness: 75,
        contrast: 80,
        saturation: 72,
        sharpness: 82,
        whiteBalance: 72,
        exposure: 70,
        dominantColors: ["#ff6b6b", "#feca57"],
    },
    content: {
        background: "gradient-sunset",
        text: ["Summer Sale"],
        products: ["GlowLab Summer Kit"],
        logos: ["GlowLab"],
    },
    tags: ["banner", "validation"],
    keywords: ["summer", "glowlab"],
};
async function runFullPipeline(foundation, sample, opts) {
    await foundation.getImageAnalysisEngine().analyzeImage(sample);
    await foundation.getImageUnderstandingEngine().understandImage({
        imageId: sample.imageId,
        industry: opts?.industry,
        marketingGoal: opts?.marketingGoal,
        platform: opts?.platform,
    });
    await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId: sample.imageId });
    await foundation.getLightingColorIntelligenceEngine().analyzeLightingColor({ imageId: sample.imageId });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 6H Brand Visual Intelligence Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-6h-validation");
        const foundation = core.getManager().imageIntelligenceFoundation;
        const engine = foundation.getBrandVisualIntelligenceEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Brand Visual Intelligence Engine operational",
        };
        await runFullPipeline(foundation, SAMPLE_KWIZERA_PRODUCT, {
            industry: "technology",
            marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
            platform: ImageUnderstandingPlatform.Ecommerce,
        });
        const analyzeStart = Date.now();
        const kwizeraProduct = await engine.analyzeBrandVisual({
            imageId: "step6h-kwizera-pro-hero",
            brandName: "KWIZERA",
            industry: "technology",
            visualStyle: BrandVisualStyle.Technology,
        });
        const analyzeMs = Date.now() - analyzeStart;
        results.brandAnalysis = {
            passed: kwizeraProduct.success && Boolean(kwizeraProduct.record?.profile.brandId),
            detail: `${kwizeraProduct.record?.profile.brandName} profile analyzed in ${analyzeMs}ms, consistency ${kwizeraProduct.record?.scores.brandConsistencyScore}`,
        };
        results.logoValidation = {
            passed: (kwizeraProduct.record?.logoAnalysis.logoVisibility ?? 0) >= 50 &&
                Boolean(kwizeraProduct.record?.logoAnalysis.logoSafeArea),
            detail: `Visibility ${kwizeraProduct.record?.logoAnalysis.logoVisibility}, consistency ${kwizeraProduct.record?.logoAnalysis.logoConsistency}`,
        };
        results.colorValidation = {
            passed: (kwizeraProduct.record?.colorAnalysis.primaryBrandColors.length ?? 0) >= 1 &&
                (kwizeraProduct.record?.colorAnalysis.colorHarmony ?? 0) >= 50,
            detail: `Primary ${kwizeraProduct.record?.colorAnalysis.primaryBrandColors.join(", ")}, harmony ${kwizeraProduct.record?.colorAnalysis.colorHarmony}`,
        };
        results.typographyValidation = {
            passed: Boolean(kwizeraProduct.record?.typography.primaryFont),
            detail: `${kwizeraProduct.record?.typography.primaryFont} / ${kwizeraProduct.record?.typography.headingStyle}`,
        };
        results.brandPlanning = {
            passed: Boolean(kwizeraProduct.record?.planning.consistencyProtectionPlan),
            detail: kwizeraProduct.record?.planning.visualStylePlan?.slice(0, 55) ?? "n/a",
        };
        results.qualityScores = {
            passed: (kwizeraProduct.record?.scores.brandConsistencyScore ?? 0) >= 55 &&
                (kwizeraProduct.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Consistency ${kwizeraProduct.record?.scores.brandConsistencyScore}, logo ${kwizeraProduct.record?.scores.logoQualityScore}, confidence ${kwizeraProduct.record?.scores.aiConfidenceScore}`,
        };
        results.recommendationReadiness = {
            passed: (kwizeraProduct.record?.recommendations.length ?? 0) >= 1,
            detail: `${kwizeraProduct.record?.recommendations.length} recommendation(s) generated`,
        };
        await runFullPipeline(foundation, SAMPLE_KWIZERA_LIFESTYLE, { industry: "fashion" });
        await runFullPipeline(foundation, SAMPLE_GLOWLAB, {
            industry: "beauty",
            marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
        });
        const kwizeraLifestyle = await engine.analyzeBrandVisual({
            imageId: "step6h-kwizera-lifestyle",
            brandName: "KWIZERA",
            industry: "fashion",
            visualStyle: BrandVisualStyle.Fashion,
        });
        const glowlab = await engine.analyzeBrandVisual({
            imageId: "step6h-glowlab-banner",
            brandName: "GlowLab",
            industry: "beauty",
            visualStyle: BrandVisualStyle.Beauty,
        });
        results.multiBrandAnalysis = {
            passed: kwizeraLifestyle.success &&
                glowlab.success &&
                kwizeraLifestyle.record?.visualStyle === BrandVisualStyle.Fashion &&
                glowlab.record?.visualStyle === BrandVisualStyle.Beauty,
            detail: `KWIZERA ${kwizeraLifestyle.record?.visualStyle}, GlowLab ${glowlab.record?.visualStyle}`,
        };
        results.relationshipDetection = {
            passed: (kwizeraLifestyle.record?.relationships.relatedImages.length ?? 0) >= 1,
            detail: `KWIZERA lifestyle linked to ${kwizeraLifestyle.record?.relationships.relatedImages.length} related image(s)`,
        };
        const noPipeline = await engine.analyzeBrandVisual({ imageId: "step6h-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream intelligence",
        };
        const repaired = await engine.repairBrandVisual("step6h-kwizera-lifestyle");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Brand visual repair pipeline verified" : "Repair failed",
        };
        const brandSearch = engine.searchBrandVisual({ brand: "KWIZERA" });
        results.search = {
            passed: brandSearch.length >= 2,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const styleSearch = engine.searchBrandVisual({ visualStyle: BrandVisualStyle.Beauty });
        results.visualStyleSearch = {
            passed: styleSearch.length >= 1,
            detail: `${styleSearch.length} result(s) by visual style`,
        };
        const colorSearch = engine.searchBrandVisual({ color: "#e94560" });
        results.colorSearch = {
            passed: colorSearch.length >= 1,
            detail: `${colorSearch.length} result(s) by color`,
        };
        const relationships = engine.detectRelationships("step6h-kwizera-pro-hero");
        results.relationshipUpdate = {
            passed: Boolean(relationships?.relatedStoryboards.length),
            detail: `${relationships?.relatedStoryboards.length ?? 0} storyboard relationship(s)`,
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
        const logFile = path.join(storageRoot, "logs", `brand-visual-intelligence-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.performance = {
            passed: status.performance.averageAnalysisMs < 120000,
            detail: `avg analysis ${status.performance.averageAnalysisMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("brand-visual-intelligence");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-6h-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Brand-Visual-Report.md"), buildBrandVisualReport(status, results, storageRoot, allPassed, kwizeraProduct.record, kwizeraLifestyle.record, glowlab.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Logo-Validation-Report.md"), buildLogoReport(kwizeraProduct.record, kwizeraLifestyle.record, glowlab.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Brand-Color-Report.md"), buildColorReport(kwizeraProduct.record, kwizeraLifestyle.record, glowlab.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Typography-Report.md"), buildTypographyReport(kwizeraProduct.record, kwizeraLifestyle.record, glowlab.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Brand-Readiness-Report.md"), buildReadinessReport(status, allPassed), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-6H-VALIDATION-REPORT.md"), buildBrandVisualReport(status, results, storageRoot, allPassed, kwizeraProduct.record, kwizeraLifestyle.record, glowlab.record), "utf8");
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
function buildBrandVisualReport(status, results, storageRoot, allPassed, product, lifestyle, glowlab) {
    return [
        "# Brand Visual Report — Step 6H",
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
        "## Brands Analyzed",
        "",
        `- KWIZERA Product: ${product?.visualStyle ?? "n/a"} — consistency ${product?.scores.brandConsistencyScore ?? 0}/100`,
        `- KWIZERA Lifestyle: ${lifestyle?.visualStyle ?? "n/a"} — consistency ${lifestyle?.scores.brandConsistencyScore ?? 0}/100`,
        `- GlowLab: ${glowlab?.visualStyle ?? "n/a"} — consistency ${glowlab?.scores.brandConsistencyScore ?? 0}/100`,
        "",
        `Brands analyzed: ${status.brandsAnalyzed}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 6H Brand Visual Intelligence Engine validation complete. Awaiting user approval before Step 6I.",
        "",
    ].join("\n");
}
function buildLogoReport(product, lifestyle, glowlab) {
    const rows = [product, lifestyle, glowlab].filter(Boolean);
    return [
        "# Logo Validation Report — Step 6H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Brand | Visibility | Position | Size | Contrast | Safe Area | Consistency |",
        "|-------|-------|------------|----------|------|----------|-----------|-------------|",
        ...rows.map((r) => `| ${r.imageId} | ${r.profile.brandName} | ${r.logoAnalysis.logoVisibility} | ${r.logoAnalysis.logoPosition} | ${r.logoAnalysis.logoSize} | ${r.logoAnalysis.logoContrast} | ${r.logoAnalysis.logoSafeArea} | ${r.logoAnalysis.logoConsistency} |`),
        "",
        "## Logo Quality Scores",
        "",
        ...rows.map((r) => `- ${r.imageId}: ${r.scores.logoQualityScore}/100`),
        "",
    ].join("\n");
}
function buildColorReport(product, lifestyle, glowlab) {
    const rows = [product, lifestyle, glowlab].filter(Boolean);
    return [
        "# Brand Color Report — Step 6H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Brand | Primary | Secondary | Accent | Harmony | Consistency |",
        "|-------|-------|---------|-----------|--------|---------|-------------|",
        ...rows.map((r) => `| ${r.imageId} | ${r.profile.brandName} | ${r.colorAnalysis.primaryBrandColors.join(", ")} | ${r.colorAnalysis.secondaryColors.join(", ") || "none"} | ${r.colorAnalysis.accentColors.join(", ") || "none"} | ${r.colorAnalysis.colorHarmony} | ${r.scores.colorConsistencyScore} |`),
        "",
    ].join("\n");
}
function buildTypographyReport(product, lifestyle, glowlab) {
    const rows = [product, lifestyle, glowlab].filter(Boolean);
    return [
        "# Typography Report — Step 6H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Brand | Primary Font | Secondary Font | Heading | Body | CTA | Score |",
        "|-------|-------|--------------|----------------|---------|------|-----|-------|",
        ...rows.map((r) => `| ${r.imageId} | ${r.profile.brandName} | ${r.typography.primaryFont} | ${r.typography.secondaryFont} | ${r.typography.headingStyle} | ${r.typography.bodyStyle} | ${r.typography.ctaStyle} | ${r.scores.typographyScore} |`),
        "",
    ].join("\n");
}
function buildReadinessReport(status, allPassed) {
    return [
        "# Brand Readiness Report — Step 6H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        "",
        "## Readiness Scores",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Engine Readiness | ${status.readinessScore}/100 |`,
        `| Avg Consistency Score | ${status.averageConsistencyScore}/100 |`,
        `| Avg Logo Score | ${status.averageLogoScore}/100 |`,
        `| Brands Analyzed | ${status.brandsAnalyzed} |`,
        `| Knowledge Bridge | ${status.knowledgeBridgeStatus} |`,
        `| Memory Bridge | ${status.memoryBridgeStatus} |`,
        `| Product Intelligence Bridge | ${status.productIntelligenceBridgeStatus} |`,
        "",
        "## Performance",
        "",
        `| Avg Analysis | ${status.performance.averageAnalysisMs}ms |`,
        `| Avg Search | ${status.performance.averageSearchMs}ms |`,
        `| Avg Relationship | ${status.performance.averageRelationshipMs}ms |`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-brand-visual-intelligence-engine.js.map