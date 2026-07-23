import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BackgroundType,
  BackgroundMarketingGoal,
  createAiCore,
  ImageAnalysisType,
  ImageColorSpace,
  ImageCompressionType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
  ImageUnderstandingPlatform,
  type BackgroundIntelligenceEngineStatusReport,
  type BackgroundIntelligenceRecord,
} from "../ai/index.js";
import type { ImageAnalysisEngineInput } from "../ai/image-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-background-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_PRODUCT: ImageAnalysisEngineInput = {
  imageId: "step6e-kwizera-pro-hero",
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
  imageId: "step6e-kwizera-lifestyle",
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

const SAMPLE_BANNER: ImageAnalysisEngineInput = {
  imageId: "step6e-summer-banner",
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
  creativeStyle: "promotional",
  visual: { brightness: 75, contrast: 80, sharpness: 82, dominantColors: ["#ff6b6b", "#feca57"] },
  content: { background: "gradient-sunset", text: ["Summer Sale"] },
  tags: ["banner", "validation"],
  keywords: ["summer", "campaign"],
};

async function runFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageIntelligenceFoundation"]>,
  sample: ImageAnalysisEngineInput,
  opts?: { industry?: string; marketingGoal?: ImageUnderstandingMarketingGoal; platform?: ImageUnderstandingPlatform }
): Promise<void> {
  await foundation.getImageAnalysisEngine().analyzeImage(sample);
  await foundation.getImageUnderstandingEngine().understandImage({
    imageId: sample.imageId!,
    industry: opts?.industry,
    marketingGoal: opts?.marketingGoal,
    platform: opts?.platform,
  });
  await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId: sample.imageId! });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 6E Background Intelligence Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-6e-validation");

    const foundation = core.getManager().imageIntelligenceFoundation!;
    const engine = foundation.getBackgroundIntelligenceEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Background Intelligence Engine operational",
    };

    await runFullPipeline(foundation, SAMPLE_PRODUCT, {
      industry: "technology",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
      platform: ImageUnderstandingPlatform.Ecommerce,
    });

    const analyzeStart = Date.now();
    const product = await engine.analyzeBackground({
      imageId: "step6e-kwizera-pro-hero",
      industry: "technology",
      marketingGoal: BackgroundMarketingGoal.Conversion,
    });
    const analyzeMs = Date.now() - analyzeStart;

    results.backgroundAnalysis = {
      passed:
        product.success &&
        Boolean(product.record) &&
        product.record!.analysis.backgroundType === BackgroundType.Studio,
      detail: `${product.record?.classification.backgroundType} analyzed in ${analyzeMs}ms, quality ${product.record?.scores.backgroundQualityScore}`,
    };

    results.backgroundClassification = {
      passed:
        product.record?.classification.classificationTags.length !== undefined &&
        (product.record?.classification.classificationTags.length ?? 0) >= 2,
      detail: `Tags: ${product.record?.classification.classificationTags.join(", ")}`,
    };

    results.backgroundQuality = {
      passed:
        (product.record?.quality.visualQuality ?? 0) >= 50 &&
        (product.record?.quality.productVisibility ?? 0) >= 50,
      detail: `Visual ${product.record?.quality.visualQuality}, product visibility ${product.record?.quality.productVisibility}, distraction ${product.record?.quality.backgroundDistraction}`,
    };

    results.backgroundSuitability = {
      passed:
        (product.record?.suitability.productShowcase ?? 0) >= 55 &&
        (product.record?.suitability.advertisement ?? 0) >= 50,
      detail: `Showcase ${product.record?.suitability.productShowcase}, ad ${product.record?.suitability.advertisement}, social ${product.record?.suitability.socialMedia}`,
    };

    results.replacementPlanning = {
      passed: Boolean(product.record?.replacementPlan.backgroundIsolationPlan),
      detail: product.record?.replacementPlan.replacementStrategy?.slice(0, 60) ?? "n/a",
    };

    results.qualityScores = {
      passed:
        (product.record?.scores.backgroundQualityScore ?? 0) >= 55 &&
        (product.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Quality ${product.record?.scores.backgroundQualityScore}, suitability ${product.record?.scores.backgroundSuitabilityScore}, confidence ${product.record?.scores.aiConfidenceScore}`,
    };

    results.recommendationReadiness = {
      passed: (product.record?.recommendations.length ?? 0) >= 1,
      detail: `${product.record?.recommendations.length} recommendation(s) generated`,
    };

    await runFullPipeline(foundation, SAMPLE_LIFESTYLE, { industry: "fashion" });
    await runFullPipeline(foundation, SAMPLE_BANNER, {
      industry: "beauty",
      marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
    });

    const lifestyle = await engine.analyzeBackground({
      imageId: "step6e-kwizera-lifestyle",
      industry: "fashion",
    });
    const banner = await engine.analyzeBackground({
      imageId: "step6e-summer-banner",
      industry: "beauty",
      marketingGoal: BackgroundMarketingGoal.Awareness,
    });

    results.multiImageAnalysis = {
      passed:
        lifestyle.success &&
        banner.success &&
        lifestyle.record?.classification.backgroundType === BackgroundType.Outdoor &&
        banner.record?.classification.backgroundType === BackgroundType.Gradient,
      detail: `Lifestyle ${lifestyle.record?.classification.backgroundType}, Banner ${banner.record?.classification.backgroundType}`,
    };

    results.relationshipDetection = {
      passed: (lifestyle.record?.relationships.relatedImages.length ?? 0) >= 1,
      detail: `Lifestyle linked to ${lifestyle.record?.relationships.relatedImages.length} related image(s)`,
    };

    const noPipeline = await engine.analyzeBackground({ imageId: "step6e-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream intelligence",
    };

    const repaired = await engine.repairBackground("step6e-kwizera-lifestyle");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Background intelligence repair pipeline verified" : "Repair failed",
    };

    const typeSearch = engine.searchBackgrounds({ backgroundType: BackgroundType.Studio });
    results.search = {
      passed: typeSearch.length >= 1,
      detail: `${typeSearch.length} result(s) by background type`,
    };

    const productSearch = engine.searchBackgrounds({ product: "KWIZERA" });
    results.productSearch = {
      passed: productSearch.length >= 2,
      detail: `${productSearch.length} result(s) by product`,
    };

    const brandSearch = engine.searchBackgrounds({ brand: "KWIZERA" });
    results.brandSearch = {
      passed: brandSearch.length >= 1,
      detail: `${brandSearch.length} result(s) by brand`,
    };

    const relationships = engine.detectRelationships("step6e-kwizera-pro-hero");
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
    const logFile = path.join(storageRoot, "logs", `background-intelligence-${logDate}.jsonl`);
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

    const registered = foundation.getRegistry().getModule("background-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    await core.stop("step-6e-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Background-Analysis-Report.md"),
      buildAnalysisReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Background-Suitability-Report.md"),
      buildSuitabilityReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Background-Quality-Report.md"),
      buildQualityReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Background-Readiness-Report.md"),
      buildReadinessReport(status, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-6E-VALIDATION-REPORT.md"),
      buildAnalysisReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
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

function buildAnalysisReport(
  status: BackgroundIntelligenceEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  product?: BackgroundIntelligenceRecord,
  lifestyle?: BackgroundIntelligenceRecord,
  banner?: BackgroundIntelligenceRecord
): string {
  return [
    "# Background Analysis Report — Step 6E",
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
    "## Images Analyzed",
    "",
    `- Product: ${product?.backgroundLabel ?? "n/a"} (${product?.classification.backgroundType ?? "n/a"}) — quality ${product?.scores.backgroundQualityScore ?? 0}/100`,
    `- Lifestyle: ${lifestyle?.backgroundLabel ?? "n/a"} (${lifestyle?.classification.backgroundType ?? "n/a"}) — quality ${lifestyle?.scores.backgroundQualityScore ?? 0}/100`,
    `- Banner: ${banner?.backgroundLabel ?? "n/a"} (${banner?.classification.backgroundType ?? "n/a"}) — quality ${banner?.scores.backgroundQualityScore ?? 0}/100`,
    "",
    `Images analyzed: ${status.imagesAnalyzed}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 6E Background Intelligence Engine validation complete. Awaiting user approval before Step 6F.",
    "",
  ].join("\n");
}

function buildSuitabilityReport(
  product?: BackgroundIntelligenceRecord,
  lifestyle?: BackgroundIntelligenceRecord,
  banner?: BackgroundIntelligenceRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as BackgroundIntelligenceRecord[];
  return [
    "# Background Suitability Report — Step 6E",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Showcase | Advertisement | Social | Poster | Banner | Thumbnail | Video |",
    "|-------|----------|---------------|--------|--------|--------|-----------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.suitability.productShowcase} | ${r.suitability.advertisement} | ${r.suitability.socialMedia} | ${r.suitability.poster} | ${r.suitability.banner} | ${r.suitability.thumbnail} | ${r.suitability.videoProduction} |`
    ),
    "",
    "## Suitability Scores",
    "",
    ...rows.map((r) => `- ${r.imageId}: ${r.scores.backgroundSuitabilityScore}/100`),
    "",
  ].join("\n");
}

function buildQualityReport(
  product?: BackgroundIntelligenceRecord,
  lifestyle?: BackgroundIntelligenceRecord,
  banner?: BackgroundIntelligenceRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as BackgroundIntelligenceRecord[];
  return [
    "# Background Quality Report — Step 6E",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Type | Complexity | Visual Quality | Distraction | Color Harmony | Brand Compat | Cleanliness |",
    "|-------|------|------------|----------------|-------------|---------------|--------------|-------------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.analysis.backgroundType} | ${r.analysis.backgroundComplexity} | ${r.quality.visualQuality} | ${r.quality.backgroundDistraction} | ${r.quality.colorHarmony} | ${r.quality.brandCompatibility} | ${r.analysis.backgroundCleanliness} |`
    ),
    "",
    "## Quality Scores",
    "",
    ...rows.map(
      (r) =>
        `- ${r.imageId}: quality ${r.scores.backgroundQualityScore}/100, brand ${r.scores.brandCompatibilityScore}/100, creative ${r.scores.creativeReadinessScore}/100`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(status: BackgroundIntelligenceEngineStatusReport, allPassed: boolean): string {
  return [
    "# Background Readiness Report — Step 6E",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    "",
    "## Readiness Scores",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Engine Readiness | ${status.readinessScore}/100 |`,
    `| Avg Quality Score | ${status.averageQualityScore}/100 |`,
    `| Avg Suitability Score | ${status.averageSuitabilityScore}/100 |`,
    `| Images Analyzed | ${status.imagesAnalyzed} |`,
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
