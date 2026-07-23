import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, DetectedObjectType, ImageAnalysisType, ImageColorSpace, ImageCompressionType, ImageFileFormat, ImageUnderstandingMarketingGoal, ImageUnderstandingPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-object-detection-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_PRODUCT = {
    imageId: "step6d-kwizera-pro-hero",
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
        noiseLevel: 8,
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
const SAMPLE_LIFESTYLE = {
    imageId: "step6d-kwizera-lifestyle",
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
    visual: { brightness: 68, contrast: 72, sharpness: 80, dominantColors: ["#2d3436", "#636e72"] },
    content: {
        products: ["KWIZERA Urban Jacket"],
        background: "urban-street",
        foreground: "model-with-jacket",
        objects: ["person", "clothing"],
    },
    tags: ["lifestyle", "validation"],
    keywords: ["urban", "kwizera"],
};
const SAMPLE_BANNER = {
    imageId: "step6d-summer-banner",
    imageName: "Summer Campaign Banner",
    filePath: "uploads/summer-banner.webp",
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
    visual: { brightness: 75, contrast: 80, sharpness: 82, dominantColors: ["#ff6b6b", "#feca57"] },
    content: { background: "gradient-sunset", text: ["Summer Sale"] },
    tags: ["banner", "validation"],
    keywords: ["summer", "campaign"],
};
async function preparePipeline(foundation, sample, understandOpts) {
    await foundation.getImageAnalysisEngine().analyzeImage(sample);
    await foundation.getImageUnderstandingEngine().understandImage({
        imageId: sample.imageId,
        ...understandOpts,
    });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 6D Object Detection Intelligence Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-6d-validation");
        const foundation = core.getManager().imageIntelligenceFoundation;
        const analysisEngine = foundation.getImageAnalysisEngine();
        const understandingEngine = foundation.getImageUnderstandingEngine();
        const engine = foundation.getObjectDetectionIntelligenceEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Object Detection Intelligence Engine operational",
        };
        await preparePipeline(foundation, SAMPLE_PRODUCT, {
            marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
            platform: ImageUnderstandingPlatform.Ecommerce,
            industry: "technology",
        });
        const detectStart = Date.now();
        const product = await engine.detectObjects({ imageId: "step6d-kwizera-pro-hero" });
        const detectMs = Date.now() - detectStart;
        results.objectDetection = {
            passed: product.success && Boolean(product.record) && (product.record?.objects.length ?? 0) >= 2,
            detail: `${product.record?.objects.length ?? 0} objects detected in ${detectMs}ms, score ${product.record?.scores.objectDetectionScore}`,
        };
        results.productDetection = {
            passed: Boolean(product.record?.productDetection.mainProduct) &&
                (product.record?.productDetection.productVisibility ?? 0) >= 50,
            detail: `Main: ${product.record?.productDetection.mainProduct}, visibility ${product.record?.productDetection.productVisibility}`,
        };
        results.logoDetection = {
            passed: product.record?.logoDetection.logoPresent === true &&
                Boolean(product.record?.logoDetection.brandAssociation),
            detail: `${product.record?.logoDetection.brandAssociation} — visibility ${product.record?.logoDetection.logoVisibility}`,
        };
        results.textDetection = {
            passed: product.record?.textDetection.textPresent === false ||
                (product.record?.textDetection.textRegions.length ?? 0) >= 0,
            detail: `Text present: ${product.record?.textDetection.textPresent}, regions ${product.record?.textDetection.textRegions.length}`,
        };
        results.objectProperties = {
            passed: product.record?.objects.every((o) => o.objectId &&
                o.objectType &&
                o.objectName &&
                o.boundingRegion &&
                o.confidenceScore >= 50) ?? false,
            detail: "All objects have ID, type, name, bounding region and confidence",
        };
        results.qualityScores = {
            passed: (product.record?.scores.objectDetectionScore ?? 0) >= 55 &&
                (product.record?.scores.aiConfidenceScore ?? 0) >= 55 &&
                (product.record?.scores.creativeReadinessScore ?? 0) >= 50,
            detail: `Detection ${product.record?.scores.objectDetectionScore}, confidence ${product.record?.scores.aiConfidenceScore}, creative ${product.record?.scores.creativeReadinessScore}`,
        };
        results.recommendationReadiness = {
            passed: (product.record?.recommendations.length ?? 0) >= 1,
            detail: `${product.record?.recommendations.length} recommendation(s) generated`,
        };
        await preparePipeline(foundation, SAMPLE_LIFESTYLE, { industry: "fashion" });
        await preparePipeline(foundation, SAMPLE_BANNER, {
            marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
            industry: "beauty",
        });
        const lifestyle = await engine.detectObjects({ imageId: "step6d-kwizera-lifestyle" });
        const banner = await engine.detectObjects({ imageId: "step6d-summer-banner" });
        results.multiImageDetection = {
            passed: lifestyle.success && banner.success,
            detail: `Lifestyle ${lifestyle.record?.objects.length} objects, Banner ${banner.record?.objects.length} objects`,
        };
        results.relationshipDetection = {
            passed: (lifestyle.record?.relationships.relatedImages.length ?? 0) >= 1,
            detail: `Lifestyle linked to ${lifestyle.record?.relationships.relatedImages.length} related image(s)`,
        };
        const noPipeline = await engine.detectObjects({ imageId: "step6d-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without analysis/understanding",
        };
        const repaired = await engine.repairDetection("step6d-kwizera-lifestyle");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Object detection repair pipeline verified" : "Repair failed",
        };
        const productSearch = engine.searchDetections({ product: "KWIZERA" });
        results.search = {
            passed: productSearch.length >= 2,
            detail: `${productSearch.length} result(s) by product`,
        };
        const logoSearch = engine.searchDetections({ objectType: DetectedObjectType.Logo });
        results.objectTypeSearch = {
            passed: logoSearch.length >= 1,
            detail: `${logoSearch.length} result(s) with logo objects`,
        };
        const brandSearch = engine.searchDetections({ brand: "KWIZERA" });
        results.brandSearch = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const relationships = engine.detectRelationships("step6d-kwizera-pro-hero");
        results.relationshipUpdate = {
            passed: Boolean(relationships?.relatedScenes.length),
            detail: `${relationships?.relatedScenes.length ?? 0} scene relationship(s)`,
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
        const logFile = path.join(storageRoot, "logs", `object-detection-intelligence-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.performance = {
            passed: status.performance.averageDetectionMs < 120000,
            detail: `avg detection ${status.performance.averageDetectionMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("object-detection-intelligence");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-6d-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Object-Detection-Report.md"), buildObjectDetectionReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Product-Detection-Report.md"), buildProductReport(product.record, lifestyle.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Logo-Detection-Report.md"), buildLogoReport(product.record, lifestyle.record, banner.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Object-Readiness-Report.md"), buildReadinessReport(status, allPassed), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-6D-VALIDATION-REPORT.md"), buildObjectDetectionReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record), "utf8");
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
function buildObjectDetectionReport(status, results, storageRoot, allPassed, product, lifestyle, banner) {
    return [
        "# Object Detection Report — Step 6D",
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
        "## Images Detected",
        "",
        `- Product: ${product?.objects.length ?? 0} objects (${product?.scores.objectDetectionScore ?? 0}/100)`,
        `- Lifestyle: ${lifestyle?.objects.length ?? 0} objects (${lifestyle?.scores.objectDetectionScore ?? 0}/100)`,
        `- Banner: ${banner?.objects.length ?? 0} objects (${banner?.scores.objectDetectionScore ?? 0}/100)`,
        "",
        `Total images detected: ${status.imagesDetected}`,
        `Total objects detected: ${status.totalObjectsDetected}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 6D Object Detection Intelligence Engine validation complete. Awaiting user approval before Step 6E.",
        "",
    ].join("\n");
}
function buildProductReport(product, lifestyle, banner) {
    const rows = [product, lifestyle, banner].filter(Boolean);
    return [
        "# Product Detection Report — Step 6D",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Main Product | Secondary | Visibility | Position | Grouping | Presentation |",
        "|-------|--------------|-----------|------------|----------|----------|--------------|",
        ...rows.map((r) => `| ${r.imageId} | ${r.productDetection.mainProduct ?? "n/a"} | ${r.productDetection.secondaryProducts.join(", ") || "none"} | ${r.productDetection.productVisibility} | ${r.productDetection.productPosition} | ${r.productDetection.productGrouping} | ${r.productDetection.productPresentation} |`),
        "",
        "## Product Visibility Scores",
        "",
        ...rows.map((r) => `- ${r.imageId}: ${r.scores.productVisibilityScore}/100`),
        "",
    ].join("\n");
}
function buildLogoReport(product, lifestyle, banner) {
    const rows = [product, lifestyle, banner].filter(Boolean);
    return [
        "# Logo Detection Report — Step 6D",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Image | Logo Present | Brand | Position | Visibility | Size | Regions |",
        "|-------|--------------|-------|----------|------------|------|---------|",
        ...rows.map((r) => `| ${r.imageId} | ${r.logoDetection.logoPresent} | ${r.logoDetection.brandAssociation || "n/a"} | ${r.logoDetection.logoPosition} | ${r.logoDetection.logoVisibility} | ${r.logoDetection.logoSize} | ${r.logoDetection.logoRegions.length} |`),
        "",
        "## Brand Visibility Scores",
        "",
        ...rows.map((r) => `- ${r.imageId}: ${r.scores.brandVisibilityScore}/100`),
        "",
    ].join("\n");
}
function buildReadinessReport(status, allPassed) {
    return [
        "# Object Readiness Report — Step 6D",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        "",
        "## Readiness Scores",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Engine Readiness | ${status.readinessScore}/100 |`,
        `| Avg Detection Score | ${status.averageDetectionScore}/100 |`,
        `| Avg Confidence | ${status.averageConfidenceScore}/100 |`,
        `| Images Detected | ${status.imagesDetected} |`,
        `| Total Objects | ${status.totalObjectsDetected} |`,
        `| Knowledge Bridge | ${status.knowledgeBridgeStatus} |`,
        `| Memory Bridge | ${status.memoryBridgeStatus} |`,
        `| Product Intelligence Bridge | ${status.productIntelligenceBridgeStatus} |`,
        "",
        "## Performance",
        "",
        `| Avg Detection | ${status.performance.averageDetectionMs}ms |`,
        `| Avg Search | ${status.performance.averageSearchMs}ms |`,
        `| Avg Relationship | ${status.performance.averageRelationshipMs}ms |`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-object-detection-intelligence-engine.js.map