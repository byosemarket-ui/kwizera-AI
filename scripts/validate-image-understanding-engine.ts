import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  ImageAnalysisType,
  ImageColorSpace,
  ImageCompressionType,
  ImageFileFormat,
  ImageSceneType,
  ImageUnderstandingMarketingGoal,
  ImageUnderstandingPlatform,
  type ImageUnderstandingEngineStatusReport,
  type ImageUnderstandingRecord,
} from "../ai/index.js";
import type { ImageAnalysisEngineInput } from "../ai/image-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-image-understanding-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_PRODUCT: ImageAnalysisEngineInput = {
  imageId: "step6c-kwizera-pro-hero",
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

const SAMPLE_LIFESTYLE: ImageAnalysisEngineInput = {
  imageId: "step6c-kwizera-lifestyle",
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
  },
  tags: ["lifestyle", "validation"],
  keywords: ["urban", "kwizera"],
};

const SAMPLE_BANNER: ImageAnalysisEngineInput = {
  imageId: "step6c-summer-banner",
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

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 6C Image Understanding Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-6c-validation");

    const foundation = core.getManager().imageIntelligenceFoundation!;
    const analysisEngine = foundation.getImageAnalysisEngine();
    const engine = foundation.getImageUnderstandingEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Image Understanding Engine operational",
    };

    await analysisEngine.analyzeImage(SAMPLE_PRODUCT);
    const understandStart = Date.now();
    const product = await engine.understandImage({
      imageId: "step6c-kwizera-pro-hero",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
      platform: ImageUnderstandingPlatform.Ecommerce,
      industry: "technology",
    });
    const understandMs = Date.now() - understandStart;

    results.imageUnderstanding = {
      passed: product.success && Boolean(product.record),
      detail: `Product image understood in ${understandMs}ms, score ${product.record?.scores.imageUnderstandingScore}`,
    };

    results.sceneUnderstanding = {
      passed:
        product.record?.scene.sceneType === ImageSceneType.ProductShowcase &&
        (product.record?.scene.preparedScenes.length ?? 0) >= 2,
      detail: `${product.record?.scene.sceneType} — ${product.record?.scene.environment} (${product.record?.scene.preparedScenes.length} scenes prepared)`,
    };

    results.productUnderstanding = {
      passed:
        (product.record?.product.productVisibility ?? 0) >= 65 &&
        product.record?.product.productReadiness === true,
      detail: `Visibility ${product.record?.product.productVisibility}, readiness ${product.record?.product.productReadiness}`,
    };

    results.brandUnderstanding = {
      passed:
        product.record?.brand.logoPresence === true &&
        (product.record?.brand.brandConsistency ?? 0) >= 50,
      detail: `${product.record?.brand.brandIdentity} — consistency ${product.record?.brand.brandConsistency}`,
    };

    results.marketingUnderstanding = {
      passed:
        Boolean(product.record?.marketing.promotionalPurpose) &&
        Boolean(product.record?.marketing.storytellingOpportunity),
      detail: product.record?.marketing.promotionalPurpose ?? "n/a",
    };

    results.understandingScores = {
      passed:
        (product.record?.scores.imageUnderstandingScore ?? 0) >= 55 &&
        (product.record?.scores.marketingReadinessScore ?? 0) >= 50 &&
        (product.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Understanding ${product.record?.scores.imageUnderstandingScore}, marketing ${product.record?.scores.marketingReadinessScore}, confidence ${product.record?.scores.aiConfidenceScore}`,
    };

    results.recommendationReadiness = {
      passed: (product.record?.recommendations.length ?? 0) >= 1,
      detail: `${product.record?.recommendations.length} recommendation(s) generated`,
    };

    await analysisEngine.analyzeImage(SAMPLE_LIFESTYLE);
    await analysisEngine.analyzeImage(SAMPLE_BANNER);
    const lifestyle = await engine.understandImage({
      imageId: "step6c-kwizera-lifestyle",
      industry: "fashion",
    });
    const banner = await engine.understandImage({
      imageId: "step6c-summer-banner",
      marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
      industry: "beauty",
    });

    results.multiTypeUnderstanding = {
      passed: lifestyle.success && banner.success,
      detail: `Lifestyle ${lifestyle.record?.scene.sceneType}, Banner ${banner.record?.scene.sceneType}`,
    };

    results.relationshipDetection = {
      passed: (lifestyle.record?.relationships.relatedImages.length ?? 0) >= 1,
      detail: `Lifestyle linked to ${lifestyle.record?.relationships.relatedImages.length} related image(s)`,
    };

    const noAnalysis = await engine.understandImage({ imageId: "step6c-nonexistent" });
    results.incompleteRejection = {
      passed: !noAnalysis.success,
      detail: noAnalysis.message ?? "Rejected without analysis",
    };

    const repaired = await engine.repairUnderstanding("step6c-kwizera-lifestyle");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Understanding repair pipeline verified" : "Repair failed",
    };

    const purposeSearch = engine.searchUnderstanding({ imagePurpose: "Showcase" });
    results.search = {
      passed: purposeSearch.length >= 1,
      detail: `${purposeSearch.length} result(s) by image purpose`,
    };

    const brandSearch = engine.searchUnderstanding({ brand: "KWIZERA" });
    results.brandSearch = {
      passed: brandSearch.length >= 2,
      detail: `${brandSearch.length} result(s) by brand`,
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
    const logFile = path.join(storageRoot, "logs", `image-understanding-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.performance = {
      passed: status.performance.averageUnderstandingMs < 120000,
      detail: `avg understanding ${status.performance.averageUnderstandingMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("image-understanding-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    await core.stop("step-6c-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Image-Understanding-Report.md"),
      buildUnderstandingReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Scene-Understanding-Report.md"),
      buildSceneReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Marketing-Readiness-Report.md"),
      buildMarketingReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Image-Readiness-Report.md"),
      buildReadinessReport(status, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-6C-VALIDATION-REPORT.md"),
      buildUnderstandingReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
      "utf8"
    );

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
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildUnderstandingReport(
  status: ImageUnderstandingEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  product?: ImageUnderstandingRecord,
  lifestyle?: ImageUnderstandingRecord,
  banner?: ImageUnderstandingRecord
): string {
  return [
    "# Image Understanding Report — Step 6C",
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
    "## Images Understood",
    "",
    `- Product: ${product?.identity.imageName ?? "n/a"} (${product?.scores.imageUnderstandingScore ?? 0}/100)`,
    `- Lifestyle: ${lifestyle?.identity.imageName ?? "n/a"} (${lifestyle?.scores.imageUnderstandingScore ?? 0}/100)`,
    `- Banner: ${banner?.identity.imageName ?? "n/a"} (${banner?.scores.imageUnderstandingScore ?? 0}/100)`,
    "",
    `Images understood: ${status.imagesUnderstood}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 6C Image Understanding Engine validation complete. Awaiting user approval before Step 6D.",
    "",
  ].join("\n");
}

function buildSceneReport(
  product?: ImageUnderstandingRecord,
  lifestyle?: ImageUnderstandingRecord,
  banner?: ImageUnderstandingRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as ImageUnderstandingRecord[];
  return [
    "# Scene Understanding Report — Step 6C",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Scene Type | Environment | Setting | Mood | Prepared Scenes |",
    "|-------|------------|-------------|---------|------|-----------------|",
    ...rows.map(
      (r) =>
        `| ${r.identity.imageName} | ${r.scene.sceneType} | ${r.scene.environment} | ${r.scene.setting} | ${r.scene.mood} | ${r.scene.preparedScenes.join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildMarketingReport(
  product?: ImageUnderstandingRecord,
  lifestyle?: ImageUnderstandingRecord,
  banner?: ImageUnderstandingRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as ImageUnderstandingRecord[];
  return [
    "# Marketing Readiness Report — Step 6C",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Marketing Readiness | Brand Consistency | Creative Readiness | Goal | CTA Opportunity |",
    "|-------|---------------------|-------------------|--------------------|------|-----------------|",
    ...rows.map(
      (r) =>
        `| ${r.identity.imageName} | ${r.scores.marketingReadinessScore}/100 | ${r.scores.brandConsistencyScore}/100 | ${r.scores.creativeReadinessScore}/100 | ${r.marketingGoal} | ${r.marketing.ctaOpportunity.slice(0, 40)}... |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(status: ImageUnderstandingEngineStatusReport, allPassed: boolean): string {
  return [
    "# Image Readiness Report — Step 6C",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    "",
    "## Readiness Scores",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Engine Readiness | ${status.readinessScore}/100 |`,
    `| Avg Understanding | ${status.averageUnderstandingScore}/100 |`,
    `| Avg Marketing Readiness | ${status.averageMarketingReadinessScore}/100 |`,
    `| Knowledge Bridge | ${status.knowledgeBridgeStatus} |`,
    `| Memory Bridge | ${status.memoryBridgeStatus} |`,
    `| Product Intelligence Bridge | ${status.productIntelligenceBridgeStatus} |`,
    "",
  ].join("\n");
}

void main();
