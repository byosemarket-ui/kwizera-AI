import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, ImageAnalysisType, ImageColorSpace, ImageCompressionType, ImageFileFormat, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-image-analysis-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_PRODUCT = {
    imageId: "step6b-kwizera-pro-hero",
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
    metadata: { camera: "studio-rig", software: "KWIZERA Capture" },
    creationDate: "2026-01-15T10:00:00.000Z",
    lastModifiedDate: "2026-03-20T14:30:00.000Z",
    imageType: ImageAnalysisType.ProductImage,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    category: "commerce",
    subcategory: "product-hero",
    creativeStyle: "commercial",
    visual: {
        brightness: 72,
        contrast: 78,
        saturation: 65,
        sharpness: 88,
        noiseLevel: 8,
        whiteBalance: 80,
        exposure: 75,
        dynamicRange: 82,
        dominantColors: ["#1a1a2e", "#e94560", "#ffffff"],
        colorDistribution: { "#1a1a2e": 40, "#e94560": 35, "#ffffff": 25 },
    },
    content: {
        products: ["KWIZERA Pro Studio"],
        background: "studio-white",
        foreground: "KWIZERA Pro Studio",
        logos: ["KWIZERA"],
    },
    tags: ["product", "kwizera", "validation"],
    keywords: ["hero", "studio", "kwizera", "product"],
};
const SAMPLE_LIFESTYLE = {
    imageId: "step6b-kwizera-lifestyle",
    imageName: "KWIZERA Urban Lifestyle",
    filePath: "uploads/kwizera-lifestyle.jpg",
    fileFormat: ImageFileFormat.JPEG,
    fileSizeBytes: 890_000,
    width: 1920,
    height: 1280,
    colorSpace: ImageColorSpace.SRGB,
    bitDepth: 8,
    compressionType: ImageCompressionType.Lossy,
    hasTransparency: false,
    metadata: { location: "urban-studio", photographer: "KWIZERA Creative" },
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
        saturation: 70,
        sharpness: 80,
        noiseLevel: 12,
        dominantColors: ["#2d3436", "#636e72", "#dfe6e9"],
    },
    content: {
        products: ["KWIZERA Urban Jacket"],
        background: "urban-street",
        foreground: "model-with-jacket",
    },
    tags: ["lifestyle", "kwizera", "validation"],
    keywords: ["urban", "jacket", "kwizera"],
};
const SAMPLE_BANNER = {
    imageId: "step6b-summer-banner",
    imageName: "Summer Campaign Banner",
    filePath: "uploads/summer-campaign-banner.webp",
    fileFormat: ImageFileFormat.WebP,
    fileSizeBytes: 420_000,
    width: 1920,
    height: 600,
    colorSpace: ImageColorSpace.DisplayP3,
    bitDepth: 8,
    compressionType: ImageCompressionType.Lossy,
    metadata: { campaign: "summer-2026" },
    creationDate: "2026-05-01T12:00:00.000Z",
    lastModifiedDate: "2026-05-01T12:00:00.000Z",
    imageType: ImageAnalysisType.Banner,
    brand: "GlowLab",
    campaign: "summer-2026",
    category: "marketing",
    visual: {
        brightness: 75,
        contrast: 80,
        saturation: 85,
        sharpness: 82,
        dominantColors: ["#ff6b6b", "#feca57", "#ffffff"],
    },
    content: {
        background: "gradient-sunset",
        text: ["Summer Sale", "30% Off"],
    },
    tags: ["banner", "marketing", "validation"],
    keywords: ["summer", "campaign", "banner"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 6B Image Analysis Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-6b-validation");
        const engine = core.getManager().imageIntelligenceFoundation.getImageAnalysisEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Image Analysis Engine operational",
        };
        const analysisStart = Date.now();
        const product = await engine.analyzeImage(SAMPLE_PRODUCT);
        const analysisMs = Date.now() - analysisStart;
        results.imageAnalysis = {
            passed: product.success && Boolean(product.record),
            detail: `Product image analyzed in ${analysisMs}ms, completeness ${product.record?.scores.imageCompletenessScore}`,
        };
        results.technicalAnalysis = {
            passed: product.record?.technical.width === 2400 &&
                product.record?.technical.height === 1600 &&
                product.record?.technical.aspectRatio === "3:2",
            detail: `${product.record?.technical.resolution} ${product.record?.technical.orientation} ${product.record?.technical.fileFormat}`,
        };
        results.classification = {
            passed: product.record?.classification.imageType === ImageAnalysisType.ProductImage,
            detail: `${product.record?.classification.imageType}/${product.record?.classification.category}/${product.record?.classification.subcategory}`,
        };
        results.completenessScoring = {
            passed: (product.record?.scores.imageCompletenessScore ?? 0) >= 55,
            detail: `Completeness ${product.record?.scores.imageCompletenessScore}, technical ${product.record?.scores.technicalQualityScore}`,
        };
        results.qualityScores = {
            passed: (product.record?.scores.visualQualityScore ?? 0) >= 50 &&
                (product.record?.scores.analysisConfidenceScore ?? 0) >= 55,
            detail: `Visual ${product.record?.scores.visualQualityScore}, confidence ${product.record?.scores.analysisConfidenceScore}`,
        };
        const lifestyle = await engine.analyzeImage(SAMPLE_LIFESTYLE);
        const banner = await engine.analyzeImage(SAMPLE_BANNER);
        results.multiTypeAnalysis = {
            passed: lifestyle.success && banner.success,
            detail: `Lifestyle ${lifestyle.record?.classification.imageType}, Banner ${banner.record?.classification.imageType}`,
        };
        results.relationshipDetection = {
            passed: (lifestyle.record?.relationships.relatedImages.length ?? 0) >= 1,
            detail: `Lifestyle linked to ${lifestyle.record?.relationships.relatedImages.length} related image(s), brands: ${lifestyle.record?.relationships.relatedBrands.join(", ")}`,
        };
        const incomplete = await engine.analyzeImage({ imageId: "step6b-incomplete", imageName: "Incomplete" });
        results.incompleteRejection = {
            passed: !incomplete.success,
            detail: incomplete.message ?? incomplete.diagnostics.join("; "),
        };
        const repaired = await engine.repairImage("step6b-kwizera-lifestyle");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Repair pipeline re-validated existing image" : "Repair failed",
        };
        const searchResults = engine.searchImages({ brand: "KWIZERA", limit: 10 });
        results.search = {
            passed: searchResults.length >= 2,
            detail: `${searchResults.length} image(s) found by brand`,
        };
        const resolutionSearch = engine.searchImages({ resolution: "2400x1600" });
        results.resolutionSearch = {
            passed: resolutionSearch.length === 1 && resolutionSearch[0]?.imageId === "step6b-kwizera-pro-hero",
            detail: `Resolution search returned ${resolutionSearch.length} result(s)`,
        };
        const colorSearch = engine.searchImages({ dominantColor: "#e94560" });
        results.colorSearch = {
            passed: colorSearch.length >= 1,
            detail: `${colorSearch.length} image(s) found by dominant color`,
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
        const logFile = path.join(storageRoot, "logs", `image-analysis-engine-${logDate}.jsonl`);
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
        const registered = core.getManager().imageIntelligenceFoundation.getRegistry().getModule("image-analysis-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-6b-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        const analysisReport = buildAnalysisReport(status, results, storageRoot, allPassed);
        const classificationReport = buildClassificationReport(product.record, lifestyle.record, banner.record);
        const qualityReport = buildQualityReport(status, product.record, lifestyle.record, banner.record, allPassed);
        fs.writeFileSync(path.join(projectStateDir, "Image-Analysis-Report.md"), analysisReport, "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Classification-Report.md"), classificationReport, "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-Quality-Report.md"), qualityReport, "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-6B-VALIDATION-REPORT.md"), analysisReport, "utf8");
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
function buildAnalysisReport(status, results, storageRoot, allPassed) {
    return [
        "# Image Analysis Report — Step 6B",
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
        "## Engine Status",
        "",
        `- Images analyzed: ${status.imagesAnalyzed}`,
        `- Avg completeness: ${status.averageCompletenessScore}`,
        `- Avg confidence: ${status.averageConfidenceScore}`,
        `- Knowledge bridge: ${status.knowledgeBridgeStatus}`,
        `- Memory bridge: ${status.memoryBridgeStatus}`,
        `- Product Intelligence bridge: ${status.productIntelligenceBridgeStatus}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 6B Image Analysis Engine validation complete. Awaiting user approval before Step 6C.",
        "",
    ].join("\n");
}
function buildClassificationReport(product, lifestyle, banner) {
    const rows = [product, lifestyle, banner].filter(Boolean);
    return [
        "# Image Classification Report — Step 6B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Type | Category | Subcategory | Creative Style | Use Case |",
        "|-------|------|----------|-------------|----------------|----------|",
        ...rows.map((r) => `| ${r.technical.imageName} | ${r.classification.imageType} | ${r.classification.category} | ${r.classification.subcategory} | ${r.classification.creativeStyle} | ${r.classification.useCase} |`),
        "",
    ].join("\n");
}
function buildQualityReport(status, product, lifestyle, banner, allPassed) {
    const rows = [product, lifestyle, banner].filter(Boolean);
    return [
        "# Image Quality Report — Step 6B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        "",
        "## Readiness Scores",
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Engine Readiness | ${status.readinessScore}/100 |`,
        `| Avg Completeness | ${status.averageCompletenessScore}/100 |`,
        `| Avg Confidence | ${status.averageConfidenceScore}/100 |`,
        "",
        "## Per-Image Quality Scores",
        "",
        "| Image | Completeness | Technical | Visual | Confidence |",
        "|-------|--------------|-----------|--------|------------|",
        ...rows.map((r) => `| ${r.technical.imageName} | ${r.scores.imageCompletenessScore} | ${r.scores.technicalQualityScore} | ${r.scores.visualQualityScore} | ${r.scores.analysisConfidenceScore} |`),
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-image-analysis-engine.js.map